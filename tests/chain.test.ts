import { describe, expect, it } from "vitest";
import { createBindRecord, resolveEvents } from "@kyvera/verifier";
import type { KyveraEvent } from "@kyvera/core";
import { T0, makeIdentity, revoke, rotate, verifyAt } from "./helpers.js";

const NOW = T0 + 3600;

describe("authorization chain resolution", () => {
  it("returns UNKNOWN when no records exist", () => {
    const { resolution } = resolveEvents([], { now: NOW });
    expect(resolution.status).toBe("UNKNOWN");
  });

  it("returns INVALID when no event passes verification", () => {
    const { resolution } = resolveEvents([{ id: "nope" } as KyveraEvent], { now: NOW });
    expect(resolution.status).toBe("INVALID");
    expect(resolution.rejected.length).toBeGreaterThan(0);
  });

  it("returns INVALID for records from a different network", async () => {
    const identity = await makeIdentity("chain-network");
    const { resolution } = resolveEvents([identity.bind.event], { now: NOW, network: "chipnet" });
    expect(resolution.status).toBe("INVALID");
    expect(resolution.rejected[0]?.code).toBe("BCH_NETWORK_UNEXPECTED");
  });

  it("detects two valid genesis bindings for the same identity key", async () => {
    const identity = await makeIdentity("chain-genesis-conflict");
    const second = await createBindRecord({
      signer: identity.signer,
      bchPrivateKey: identity.bchB.privateKey,
      bch: identity.bchB.identity,
      issuedAt: T0 + 1,
    });
    const { resolution } = resolveEvents([identity.bind.event, second.event], { now: NOW });
    expect(resolution.status).toBe("CONFLICT");
    expect(resolution.reasonCode).toBe("GENESIS_EQUIVOCATION");
  });

  it("returns STALE when only a transition is available", async () => {
    const identity = await makeIdentity("chain-missing-genesis");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const { resolution } = resolveEvents([rotation.event], { now: NOW });
    expect(resolution.status).toBe("STALE");
    expect(resolution.reasonCode).toBe("MISSING_GENESIS");
  });

  it("resolves the same state regardless of event order", async () => {
    const identity = await makeIdentity("chain-order");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const revocation = await revoke(identity, rotation, identity.bchB);
    const forward = resolveEvents(
      [identity.bind.event, rotation.event, revocation.event],
      { now: NOW },
    ).resolution;
    const reverse = resolveEvents(
      [revocation.event, rotation.event, identity.bind.event],
      { now: NOW },
    ).resolution;
    expect(forward.status).toBe("REVOKED");
    expect(reverse.status).toBe("REVOKED");
    expect(forward.history.map((step) => step.recordId)).toEqual(
      reverse.history.map((step) => step.recordId),
    );
  });

  it("rejects records belonging to another subject", async () => {
    const alice = await makeIdentity("chain-alice");
    const bob = await makeIdentity("chain-bob");
    const { resolution } = resolveEvents([alice.bind.event, bob.bind.event], {
      now: NOW,
      subject: alice.subject,
    });
    expect(resolution.status).toBe("ACTIVE");
    expect(resolution.subject).toBe(alice.subject);
    expect(resolution.rejected.some((entry) => entry.code === "SUBJECT_MISMATCH")).toBe(true);
  });

  it("does not treat a valid higher-sequence orphan as current", async () => {
    const identity = await makeIdentity("chain-orphan");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const revocation = await revoke(identity, rotation, identity.bchB);
    // Omit the rotation: bind + revoke leaves a missing link.
    const { resolution } = resolveEvents([identity.bind.event, revocation.event], { now: NOW });
    expect(["STALE", "CONFLICT"]).toContain(resolution.status);
    expect(resolution.activeBch).toBeNull();
  });

  it("keeps a record valid even when its chain is invalid", async () => {
    const identity = await makeIdentity("chain-record-vs-state");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    expect(verifyAt(rotation.event, NOW).ok).toBe(true);
    const second = await rotate(identity, identity.bind, identity.bchA, identity.bchC, T0 + 61);
    const { resolution } = resolveEvents(
      [identity.bind.event, rotation.event, second.event],
      { now: NOW },
    );
    expect(resolution.status).toBe("CONFLICT");
    // Both individual records remain cryptographically valid.
    expect(verifyAt(rotation.event, NOW).ok).toBe(true);
    expect(verifyAt(second.event, NOW).ok).toBe(true);
  });
});
