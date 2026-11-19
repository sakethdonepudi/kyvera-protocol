import { describe, expect, it } from "vitest";
import {
  buildBchProofMessage,
  createBindPayload,
  digestOf,
  sealRecord,
} from "@kyvera/core";
import {
  bchKeyPairFromPrivateKey,
  hashBitcoinMessage,
  publicKeyToAddress,
  signBitcoinMessage,
} from "@kyvera/bch";
import { buildRecordEvent } from "@kyvera/nostr";
import { binToBase64, secp256k1 } from "@bitauth/libauth";
import {
  AuthRequestService,
  applyCheckpointToResolution,
  buildAuthRequestEvent,
  createBindRecord,
  createRotateRecord,
  resolveEvents,
  validateAppSession,
} from "@kyvera/verifier";
import { checkPayable, destinationChanged } from "../apps/web/lib/pay.js";
import {
  T0,
  clone,
  makeIdentity,
  reSign,
  revoke,
  rotate,
  strangerSigner,
  verifyAt,
} from "./helpers.js";

const NOW = T0 + 3_600;
const ORIGIN = "https://security.example";

function resolutionOf(events: Parameters<typeof resolveEvents>[0]) {
  return resolveEvents(events, { now: NOW }).resolution;
}

async function challengeFor(
  identity: Awaited<ReturnType<typeof makeIdentity>>,
  resolution: ReturnType<typeof resolutionOf>,
) {
  const rp = new AuthRequestService({
    origin: ORIGIN,
    domain: "security.example",
    ttlSeconds: 120,
    sessionTtlSeconds: 900,
    now: () => NOW,
    sessionId: "ab".repeat(32),
  });
  const request = rp.issue({
    expectedSubject: identity.subject,
    expectedAddress: identity.bchA.identity.address,
  });
  const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: NOW });
  return { rp, request, event, result: rp.verify(event, resolution) };
}

describe("security challenge suite", () => {
  it("rejects a BCH proof signed by a different wallet", async () => {
    const thief = await makeIdentity("sc-forge-target");
    const attacker = await makeIdentity("sc-forge-attacker");
    const record = clone(thief.bind.record);
    record.proofs.bch[0]!.signature = signBitcoinMessage(
      attacker.bchA.privateKey,
      buildBchProofMessage("new", thief.bchA.identity.address, thief.bind.payloadDigest),
    );
    const event = await reSign(record, thief.secret);
    const result = verifyAt(event);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_SIGNATURE_NOT_BY_ADDRESS");
  });

  it("rejects an external-wallet bind that reuses the Nostr key", async () => {
    const identity = await makeIdentity("sc-bind-key-reuse");
    const reused = bchKeyPairFromPrivateKey(identity.secret);
    const created = await createBindRecord({
      signer: identity.signer,
      bchPrivateKey: reused.privateKey,
      bch: { ...reused.identity, publicKey: null },
      issuedAt: T0,
    });
    const result = verifyAt(created.event);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("KEY_REUSE");
  });

  it("rejects an uncompressed BCH proof that reuses the Nostr key", async () => {
    const identity = await makeIdentity("sc-uncompressed-reuse");
    const uncompressed = secp256k1.derivePublicKeyUncompressed(identity.secret);
    if (typeof uncompressed === "string") throw new Error(uncompressed);
    const address = publicKeyToAddress(uncompressed, "mainnet");
    const payload = createBindPayload({
      subject: identity.subject,
      bch: { address, network: "mainnet", publicKey: null },
      issuedAt: T0,
      nonce: "ab".repeat(32),
    });
    const digest = digestOf(payload);
    const compact = secp256k1.signMessageHashRecoverableCompact(
      identity.secret,
      hashBitcoinMessage(buildBchProofMessage("new", address, digest)),
    );
    if (typeof compact === "string") throw new Error(compact);
    const signature = binToBase64(
      Uint8Array.from([27 + compact.recoveryId, ...compact.signature]),
    );
    const record = sealRecord(payload, [
      { algorithm: "bch-signmessage-v1", role: "new", address, signature },
    ]);
    const built = await buildRecordEvent(record, identity.signer);
    expect(built.ok).toBe(true);
    const result = verifyAt(built.event!);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("KEY_REUSE");
  });

  it("rejects duplicate protocol tags that make relay indexing ambiguous", async () => {
    const identity = await makeIdentity("sc-duplicate-tags");
    const duplicate = await identity.signer.signEvent({
      kind: identity.bind.event.kind,
      created_at: identity.bind.event.created_at,
      tags: [...identity.bind.event.tags, ["d", "kyvera:evil"]],
      content: identity.bind.event.content,
    });
    const result = verifyAt(duplicate);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("D_TAG_INVALID");
  });

  it("rejects a tampered Nostr event", async () => {
    const identity = await makeIdentity("sc-forge-nostr");
    const tampered = clone(identity.bind.event);
    tampered.content = tampered.content.replace('"sequence":0', '"sequence":1');
    const result = verifyAt(tampered);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOSTR_SIGNATURE_INVALID");
  });

  it("rejects an unauthorized rotation and keeps wallet A current", async () => {
    const identity = await makeIdentity("sc-unauthorized-rotation");
    const forged = await createRotateRecord({
      signer: identity.signer,
      previous: {
        recordId: identity.bind.recordId,
        sequence: 0,
        bch: identity.bchA.identity,
      },
      currentBchPrivateKey: identity.bchC.privateKey,
      newBchPrivateKey: identity.bchC.privateKey,
      newBch: identity.bchC.identity,
      issuedAt: T0 + 60,
    });
    const resolution = resolutionOf([identity.bind.event, forged.event]);
    expect(verifyAt(forged.event).ok).toBe(false);
    expect(resolution.status).toBe("ACTIVE");
    expect(resolution.activeBch?.address).toBe(identity.bchA.identity.address);
  });

  it("rejects a replayed login challenge", async () => {
    const identity = await makeIdentity("sc-replay");
    const resolution = resolutionOf([identity.bind.event]);
    const { rp, event, result } = await challengeFor(identity, resolution);
    expect(result.check.authenticated).toBe(true);
    expect(rp.verify(event, resolution).check.code).toBe("UNKNOWN_CHALLENGE");
  });

  it("rejects an expired login challenge", async () => {
    let now = NOW;
    const identity = await makeIdentity("sc-expired");
    const resolution = resolutionOf([identity.bind.event]);
    const rp = new AuthRequestService({
      origin: ORIGIN,
      ttlSeconds: 60,
      now: () => now,
      sessionId: "cd".repeat(32),
    });
    const request = rp.issue({ expectedSubject: identity.subject });
    const event = await buildAuthRequestEvent({ request, signer: identity.signer, createdAt: NOW });
    now = NOW + 61;
    expect(rp.verify(event, resolution).check.code).toBe("CHALLENGE_EXPIRED");
  });

  it("rejects a revoked identity and invalidates its session", async () => {
    const identity = await makeIdentity("sc-revoked");
    const bindResolution = resolutionOf([identity.bind.event]);
    const login = await challengeFor(identity, bindResolution);
    const revocation = await revoke(identity, identity.bind, identity.bchA, T0 + 60);
    const revoked = resolutionOf([identity.bind.event, revocation.event]);
    expect(revoked.status).toBe("REVOKED");
    expect(login.result.session).toBeDefined();
    expect(validateAppSession(login.result.session!, revoked, NOW).code).toBe(
      "SESSION_IDENTITY_REVOKED",
    );
  });

  it("does not silently claim a sequence whose predecessor is missing", async () => {
    const identity = await makeIdentity("sc-missing-history");
    const rotateB = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const rotateC = await rotate(identity, rotateB, identity.bchB, identity.bchC, T0 + 120);
    const resolution = resolutionOf([identity.bind.event, rotateC.event]);
    expect(resolution.status).toBe("STALE");
    expect(resolution.reasonCode).toBe("MISSING_CHAIN_SEGMENT");
    expect(resolution.head?.record.payload.sequence).toBe(0);
  });

  it("uses unique addressable d tags and detects latest-only history loss", async () => {
    const identity = await makeIdentity("sc-retention");
    const rotateB = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const revocation = await revoke(identity, rotateB, identity.bchB, T0 + 120);
    const dTag = (event: (typeof identity.bind)["event"]) =>
      event.tags.find((tag) => tag[0] === "d")?.[1];
    const tags = [identity.bind.event, rotateB.event, revocation.event].map(dTag);
    expect(tags.every(Boolean)).toBe(true);
    expect(new Set(tags).size).toBe(3);

    // A relay that keeps only the latest addressable event cannot produce a
    // current-authorization guarantee: the genesis binding is missing.
    const latestOnly = resolveEvents([revocation.event], {
      now: NOW,
      subject: identity.subject,
    }).resolution;
    expect(latestOnly.status).toBe("STALE");
    expect(latestOnly.reasonCode).toBe("MISSING_GENESIS");
    expect(latestOnly.activeBch).toBeNull();
  });

  it("keeps historical proof verification available when current state is STALE", async () => {
    const identity = await makeIdentity("sc-historical-stale");
    const rotateB = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const rotateC = await rotate(identity, rotateB, identity.bchB, identity.bchC, T0 + 120);
    const stale = resolutionOf([identity.bind.event, rotateC.event]);
    expect(stale.status).toBe("STALE");
    expect(verifyAt(identity.bind.event).ok).toBe(true);
    expect(
      checkPayable(
        {
          ...stale,
          assurance: "FULL",
          sync: { relays: [], responded: 1, total: 1, assurance: "FULL" },
        } as never,
        "mainnet",
      ).ok,
    ).toBe(false);
  });

  it("detects conflicting authorization branches", async () => {
    const identity = await makeIdentity("sc-conflict");
    const toB = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const toC = await rotate(identity, identity.bind, identity.bchA, identity.bchC, T0 + 61);
    const resolution = resolutionOf([identity.bind.event, toB.event, toC.event]);
    expect(resolution.status).toBe("CONFLICT");
    expect(resolution.reasonCode).toBe("SEQUENCE_EQUIVOCATION");
    expect(resolution.activeBch).toBeNull();
  });

  it("detects a rollback against a previously observed checkpoint", async () => {
    const identity = await makeIdentity("sc-rollback");
    const rotateB = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const base = resolutionOf([identity.bind.event]);
    const stale = applyCheckpointToResolution(base as never, {
      sequence: 1,
      recordId: rotateB.recordId,
    });
    expect(stale.status).toBe("STALE");
    expect(stale.reasonCode).toBe("ROLLBACK_DETECTED");
    expect(stale.activeBch).toBeNull();
  });

  it("blocks a payment when the destination is not ACTIVE or changes", () => {
    const address = "bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen";
    const active = {
      status: "ACTIVE",
      assurance: "FULL",
      activeBch: { address, network: "mainnet", publicKey: null },
      sync: { relays: [], responded: 1, total: 1, assurance: "FULL" },
    } as never;
    expect(checkPayable(active, "mainnet").ok).toBe(true);
    expect(
      checkPayable({ ...active, activeBch: null } as never, "mainnet").code,
    ).toBe("NO_ADDRESS");
    expect(
      checkPayable({ ...active, status: "REVOKED" } as never, "mainnet").code,
    ).toBe("STATUS_REVOKED");
    expect(
      destinationChanged(
        { subject: "a", address, status: "ACTIVE" },
        { subject: "a", address, status: "ACTIVE" },
      ),
    ).toBe(false);
    expect(
      destinationChanged(
        { subject: "a", address, status: "ACTIVE" },
        { subject: "a", address: `${address}x`, status: "ACTIVE" },
      ),
    ).toBe(true);
  });

  it("rejects a challenge signed by an unrelated key", async () => {
    const identity = await makeIdentity("sc-unrelated-signer");
    const resolution = resolutionOf([identity.bind.event]);
    const stranger = await strangerSigner();
    const rp = new AuthRequestService({ origin: ORIGIN, now: () => NOW });
    const request = rp.issue({ expectedSubject: identity.subject });
    const event = await buildAuthRequestEvent({ request, signer: stranger.signer, createdAt: NOW });
    expect(rp.verify(event, resolution).check.code).toBe("SUBJECT_MISMATCH");
  });
});
