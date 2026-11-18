import { describe, expect, it } from "vitest";
import { findAddressInChain } from "@kyvera/core";
import { createRevokeRecord, resolveEvents, verifyEventRecord } from "@kyvera/verifier";
import { T0, makeIdentity, revoke, rotate, verifyAt } from "./helpers.js";

const NOW = T0 + 3600;

describe("revocation", () => {
  it("accepts a revocation signed by the Nostr key and the current BCH key", async () => {
    const identity = await makeIdentity("revoke-valid");
    const revocation = await revoke(identity, identity.bind, identity.bchA);
    expect(verifyAt(revocation.event, NOW).ok).toBe(true);

    const { resolution } = resolveEvents([identity.bind.event, revocation.event], { now: NOW });
    expect(resolution.status).toBe("REVOKED");
    expect(resolution.activeBch).toBeNull();
    expect(resolution.head?.record.payload.type).toBe("revoke");
  });

  it("rejects a revocation signed by a wallet that does not control the address", async () => {
    const identity = await makeIdentity("revoke-unauthorized");
    const revocation = await createRevokeRecord({
      signer: identity.signer,
      previous: {
        recordId: identity.bind.recordId,
        sequence: 0,
        bch: identity.bchA.identity,
      },
      // The proof claims address A but is produced by C.
      currentBchPrivateKey: identity.bchC.privateKey,
      issuedAt: T0 + 60,
    });
    const result = verifyEventRecord(revocation.event, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BCH_SIGNATURE_NOT_BY_ADDRESS");
  });

  it("rejects a revocation signed only by the Nostr key", async () => {
    const identity = await makeIdentity("revoke-nostr-only");
    const revocation = await revoke(identity, identity.bind, identity.bchA);
    const record = JSON.parse(JSON.stringify(revocation.record));
    record.proofs.bch = [];
    const result = verifyAt({ ...revocation.event, content: JSON.stringify(record) }, NOW);
    expect(result.ok).toBe(false);
  });

  it("never returns a revoked binding as active, even if the old record is replayed", async () => {
    const identity = await makeIdentity("revoke-replay");
    const revocation = await revoke(identity, identity.bind, identity.bchA);
    const { resolution } = resolveEvents(
      [identity.bind.event, revocation.event, identity.bind.event],
      { now: NOW },
    );
    expect(resolution.status).toBe("REVOKED");
    expect(resolution.activeBch).toBeNull();
  });

  it("revokes the wallet that was current after a rotation", async () => {
    const identity = await makeIdentity("revoke-after-rotate");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const revocation = await revoke(identity, rotation, identity.bchB);
    const { resolution } = resolveEvents(
      [identity.bind.event, rotation.event, revocation.event],
      { now: NOW },
    );
    expect(resolution.status).toBe("REVOKED");
    expect(resolution.superseded.map((entry) => entry.address)).toEqual([
      identity.bchA.identity.address,
      identity.bchB.identity.address,
    ]);
    expect(resolution.superseded.map((entry) => entry.replacedBy)).toEqual([
      identity.bchB.identity.address,
      "revoked",
    ]);
  });

  it("rejects a revocation by a key that was not current in the chain", async () => {
    const identity = await makeIdentity("revoke-wrong-chain-key");
    // C signs a valid proof for C, but A is the current address.
    const revocation = await createRevokeRecord({
      signer: identity.signer,
      previous: {
        recordId: identity.bind.recordId,
        sequence: 0,
        bch: identity.bchC.identity,
      },
      currentBchPrivateKey: identity.bchC.privateKey,
      issuedAt: T0 + 60,
    });
    expect(verifyAt(revocation.event, NOW).ok).toBe(true);
    const { resolution } = resolveEvents([identity.bind.event, revocation.event], { now: NOW });
    expect(resolution.status).toBe("INVALID");
    expect(resolution.reasonCode).toBe("CURRENT_PROOF_MISMATCH");
  });

  it("marks an expired binding as EXPIRED but keeps the last identity visible", async () => {
    const identity = await makeIdentity("revoke-expired", T0);
    const { createBindRecord } = await import("@kyvera/verifier");
    const created = await createBindRecord({
      signer: identity.signer,
      bchPrivateKey: identity.bchA.privateKey,
      bch: identity.bchA.identity,
      issuedAt: T0,
      expiresAt: T0 + 100,
    });
    const { resolution } = resolveEvents([created.event], { now: T0 + 200 });
    expect(resolution.status).toBe("EXPIRED");
    expect(resolution.activeBch?.address).toBe(identity.bchA.identity.address);
  });

  it("detects competing revocations at the same sequence", async () => {
    const identity = await makeIdentity("revoke-equivocation");
    const first = await revoke(identity, identity.bind, identity.bchA, T0 + 60);
    const second = await revoke(identity, identity.bind, identity.bchA, T0 + 61);
    const { resolution } = resolveEvents(
      [identity.bind.event, first.event, second.event],
      { now: NOW },
    );
    expect(resolution.status).toBe("CONFLICT");
    expect(resolution.reasonCode).toBe("SEQUENCE_EQUIVOCATION");
  });

  it("exposes the historical address for superseded lookups", async () => {
    const identity = await makeIdentity("revoke-history");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const { resolution } = resolveEvents([identity.bind.event, rotation.event], { now: NOW });
    const step = findAddressInChain(resolution, identity.bchA.identity.address);
    expect(step?.record.payload.sequence).toBe(0);
    expect(resolution.superseded[0]?.replacedBy).toBe(identity.bchB.identity.address);
  });
});
