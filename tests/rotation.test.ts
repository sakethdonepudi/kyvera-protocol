import { describe, expect, it } from "vitest";
import {
  buildBchProofMessage,
  createRotatePayload,
  digestOf,
  sealRecord,
  type SignedRecord,
} from "@kyvera/core";
import { signBitcoinMessage } from "@kyvera/bch";
import {
  createRotateRecord,
  resolveEvents,
  verifyEventRecord,
  verifyRecord,
} from "@kyvera/verifier";
import {
  T0,
  clone,
  makeIdentity,
  rawEvent,
  reSign,
  revoke,
  rotate,
  verifyAt,
} from "./helpers.js";

const NOW = T0 + 3600;

describe("authorized rotation", () => {
  it("accepts a rotation signed by the current key, the new key and Nostr key", async () => {
    const identity = await makeIdentity("rotate-valid");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    expect(verifyAt(rotation.event, NOW).ok).toBe(true);

    const { resolution } = resolveEvents([identity.bind.event, rotation.event], { now: NOW });
    expect(resolution.status).toBe("ACTIVE");
    expect(resolution.activeBch?.address).toBe(identity.bchB.identity.address);
    expect(resolution.head?.record.payload.sequence).toBe(1);
    expect(resolution.superseded.map((entry) => entry.address)).toContain(
      identity.bchA.identity.address,
    );
  });

  it("rejects a rotation authorized by a key that does not control the current address", async () => {
    const identity = await makeIdentity("rotate-unauthorized-current");
    const rotation = await createRotateRecord({
      signer: identity.signer,
      previous: {
        recordId: identity.bind.recordId,
        sequence: 0,
        bch: identity.bchA.identity,
      },
      currentBchPrivateKey: identity.bchC.privateKey,
      newBchPrivateKey: identity.bchB.privateKey,
      newBch: identity.bchB.identity,
      issuedAt: T0 + 60,
    });
    const result = verifyEventRecord(rotation.event, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_SIGNATURE_NOT_BY_ADDRESS");
  });

  it("rejects a rotation without proof of the new wallet", async () => {
    const identity = await makeIdentity("rotate-missing-new");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const record = clone(rotation.record);
    record.proofs.bch = record.proofs.bch.filter((proof) => proof.role !== "new") as never;
    const event = rawEvent(record, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PROOF_ROLE_MATRIX");
  });

  it("rejects a rotation that references the wrong previous record", async () => {
    const identity = await makeIdentity("rotate-wrong-previous");
    const rotation = await createRotateRecord({
      signer: identity.signer,
      previous: {
        recordId: "22".repeat(32),
        sequence: 0,
        bch: identity.bchA.identity,
      },
      currentBchPrivateKey: identity.bchA.privateKey,
      newBchPrivateKey: identity.bchB.privateKey,
      newBch: identity.bchB.identity,
      issuedAt: T0 + 60,
    });
    expect(verifyAt(rotation.event, NOW).ok).toBe(true);
    const { resolution } = resolveEvents([identity.bind.event, rotation.event], { now: NOW });
    expect(resolution.status).toBe("CONFLICT");
    expect(resolution.reasonCode).toBe("CHAIN_FORK");
  });

  it("rejects a replayed rotation that does not advance the sequence", async () => {
    const identity = await makeIdentity("rotate-replay");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const { resolution } = resolveEvents(
      [identity.bind.event, rotation.event, rotation.event, identity.bind.event],
      { now: NOW },
    );
    expect(resolution.status).toBe("ACTIVE");
    expect(resolution.history).toHaveLength(2);
  });

  it("detects two competing rotations at the same sequence", async () => {
    const identity = await makeIdentity("rotate-equivocation");
    const toB = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const toC = await rotate(identity, identity.bind, identity.bchA, identity.bchC, T0 + 61);
    const { resolution } = resolveEvents(
      [identity.bind.event, toB.event, toC.event],
      { now: NOW },
    );
    expect(resolution.status).toBe("CONFLICT");
    expect(resolution.reasonCode).toBe("SEQUENCE_EQUIVOCATION");
    expect(resolution.conflict?.sequence).toBe(1);
    expect(resolution.activeBch).toBeNull();
  });

  it("rejects a stolen Nostr key rotating without the BCH key", async () => {
    const identity = await makeIdentity("rotate-stolen-nostr");
    const rotation = await createRotateRecord({
      signer: identity.signer,
      previous: {
        recordId: identity.bind.recordId,
        sequence: 0,
        bch: identity.bchA.identity,
      },
      // The attacker controls the Nostr key and the new wallet, but signs the
      // "current" role with the new key instead of the old one.
      currentBchPrivateKey: identity.bchB.privateKey,
      newBchPrivateKey: identity.bchB.privateKey,
      newBch: identity.bchB.identity,
      issuedAt: T0 + 60,
    });
    const result = verifyAt(rotation.event, NOW);
    expect(result.ok).toBe(false);
  });

  it("rejects a rotation signed by a forged transition payload", async () => {
    const identity = await makeIdentity("rotate-forged-payload");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const record = clone(rotation.record);
    // Redirect the payment destination after the proofs were produced.
    record.payload.bch = identity.bchC.identity;
    const event = rawEvent(record, identity.secret);
    const result = verifyAt(event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PROOF_ADDRESS_MISMATCH");
  });

  it("rejects a rotation that reuses the same address", async () => {
    const identity = await makeIdentity("rotate-same-address");
    await expect(rotate(identity, identity.bind, identity.bchA, identity.bchA)).rejects.toThrow(
      /ROTATION_ADDRESS_REUSED/,
    );
  });

  it("rejects a second rotation signed with the superseded wallet key", async () => {
    const identity = await makeIdentity("rotate-old-key");
    const first = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const second = await createRotateRecord({
      signer: identity.signer,
      previous: {
        recordId: first.recordId,
        sequence: 1,
        bch: identity.bchB.identity,
      },
      // A is no longer authorized; B is.
      currentBchPrivateKey: identity.bchA.privateKey,
      newBchPrivateKey: identity.bchC.privateKey,
      newBch: identity.bchC.identity,
      issuedAt: T0 + 120,
    });
    const result = verifyAt(second.event, NOW);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_SIGNATURE_NOT_BY_ADDRESS");
  });

  it("checks the current-key proof address against the chain, not just the signature", async () => {
    const identity = await makeIdentity("rotate-current-mismatch");
    const payload = createRotatePayload({
      subject: identity.subject,
      previousRecordId: identity.bind.recordId,
      sequence: 1,
      bch: identity.bchB.identity,
      issuedAt: T0 + 60,
    });
    const digest = digestOf(payload);
    const record = sealRecord(payload, [
      {
        algorithm: "bch-signmessage-v1",
        role: "current",
        address: identity.bchC.identity.address,
        signature: signBitcoinMessage(
          identity.bchC.privateKey,
          buildBchProofMessage("current", identity.bchC.identity.address, digest),
        ),
      },
      {
        algorithm: "bch-signmessage-v1",
        role: "new",
        address: identity.bchB.identity.address,
        signature: signBitcoinMessage(
          identity.bchB.privateKey,
          buildBchProofMessage("new", identity.bchB.identity.address, digest),
        ),
      },
    ]);
    const event = rawEvent(record, identity.secret);
    expect(verifyAt(event, NOW).ok).toBe(true);
    const { resolution } = resolveEvents([identity.bind.event, event], { now: NOW });
    expect(resolution.status).toBe("INVALID");
    expect(resolution.reasonCode).toBe("CURRENT_PROOF_MISMATCH");
  });

  it("rejects any transition after a revocation", async () => {
    const identity = await makeIdentity("rotate-after-revoke");
    const revocation = await revoke(identity, identity.bind, identity.bchA, T0 + 60);
    const after = await createRotateRecord({
      signer: identity.signer,
      previous: {
        recordId: revocation.recordId,
        sequence: 1,
        bch: identity.bchA.identity,
      },
      currentBchPrivateKey: identity.bchA.privateKey,
      newBchPrivateKey: identity.bchB.privateKey,
      newBch: identity.bchB.identity,
      issuedAt: T0 + 120,
    });
    expect(verifyAt(after.event, NOW).ok).toBe(true);
    const { resolution } = resolveEvents(
      [identity.bind.event, revocation.event, after.event],
      { now: NOW },
    );
    expect(resolution.status).toBe("CONFLICT");
    expect(resolution.reasonCode).toBe("TRANSITION_AFTER_REVOKE");
  });

  it("rejects a rotation whose issuedAt does not advance", async () => {
    const identity = await makeIdentity("rotate-time");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0);
    const { resolution } = resolveEvents([identity.bind.event, rotation.event], { now: NOW });
    expect(resolution.status).toBe("INVALID");
    expect(resolution.reasonCode).toBe("TIME_NOT_MONOTONIC");
  });

  it("treats a valid record with a skipped sequence as stale, not current", async () => {
    const identity = await makeIdentity("rotate-gap");
    const skipped = await createRotateRecord({
      signer: identity.signer,
      // Claims sequence 2 while sequence 1 is unavailable.
      previous: {
        recordId: identity.bind.recordId,
        sequence: 1,
        bch: identity.bchA.identity,
      },
      currentBchPrivateKey: identity.bchA.privateKey,
      newBchPrivateKey: identity.bchB.privateKey,
      newBch: identity.bchB.identity,
      issuedAt: T0 + 60,
    });
    expect(verifyAt(skipped.event, NOW).ok).toBe(true);
    const { resolution } = resolveEvents([identity.bind.event, skipped.event], { now: NOW });
    expect(resolution.status).toBe("STALE");
    expect(resolution.reasonCode).toBe("MISSING_CHAIN_SEGMENT");
    expect(resolution.activeBch).toBeNull();
  });

  it("verifies a record independently of its chain", async () => {
    const identity = await makeIdentity("rotate-independent");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const record: SignedRecord = rotation.record;
    expect(verifyRecord(record, { now: NOW }).ok).toBe(true);
  });
});
