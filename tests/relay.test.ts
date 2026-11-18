import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  resolveAddress,
  resolveIdentity,
} from "@kyvera/verifier";
import { publishToRelays } from "@kyvera/nostr";
import { LocalRelay } from "./support/relay.js";
import { T0, makeIdentity, revoke, rotate } from "./helpers.js";
import type { KyveraEvent } from "@kyvera/core";
import { finalizeEvent } from "nostr-tools/pure";

const NOW = T0 + 3600;

let full: LocalRelay;
let stale: LocalRelay;
let hostile: LocalRelay;

beforeAll(async () => {
  full = await LocalRelay.start();
  stale = await LocalRelay.start();
  // Accepts any event without checking signatures: simulates a malicious relay.
  hostile = await LocalRelay.start({ verifySignatures: false });
});

afterAll(async () => {
  await Promise.all([full.close(), stale.close(), hostile.close()]);
});

describe("decentralized discovery", () => {
  it("publishes a binding and resolves it from a relay", async () => {
    const identity = await makeIdentity("relay-basic");
    const reports = await publishToRelays([full.url], identity.bind.event);
    expect(reports[0]?.ok).toBe(true);

    const result = await resolveIdentity({ subject: identity.subject, relays: [full.url], now: NOW });
    expect(result.status).toBe("ACTIVE");
    expect(result.activeBch?.address).toBe(identity.bchA.identity.address);
    expect(result.assurance).toBe("FULL");
    expect(result.sync.responded).toBe(1);
  });

  it("deduplicates the same event returned many times", async () => {
    const identity = await makeIdentity("relay-dedupe");
    full.seed(identity.bind.event, identity.bind.event, identity.bind.event);
    const result = await resolveIdentity({ subject: identity.subject, relays: [full.url], now: NOW });
    expect(result.status).toBe("ACTIVE");
    expect(result.history).toHaveLength(1);
  });

  it("reports partial synchronization when one relay is unreachable", async () => {
    const identity = await makeIdentity("relay-partial");
    full.seed(identity.bind.event);
    const result = await resolveIdentity({
      subject: identity.subject,
      relays: [full.url, "ws://127.0.0.1:1"],
      now: NOW,
      connectionTimeoutMs: 800,
      queryTimeoutMs: 1_500,
    });
    expect(result.status).toBe("ACTIVE");
    expect(result.assurance).toBe("PARTIAL");
    expect(result.sync.responded).toBe(1);
    expect(result.sync.total).toBe(2);
  });

  it("returns STALE, never ACTIVE, when no relay responds", async () => {
    const identity = await makeIdentity("relay-unreachable");
    const result = await resolveIdentity({
      subject: identity.subject,
      relays: ["ws://127.0.0.1:1"],
      now: NOW,
      connectionTimeoutMs: 800,
      queryTimeoutMs: 1_500,
    });
    expect(result.status).toBe("STALE");
    expect(result.assurance).toBe("UNSYNCED");
    expect(result.activeBch).toBeNull();
  });

  it("returns STALE when no relays are configured", async () => {
    const identity = await makeIdentity("relay-none");
    const result = await resolveIdentity({ subject: identity.subject, relays: [], now: NOW });
    expect(result.status).toBe("STALE");
    expect(result.reasonCode).toBe("NO_RELAYS_CONFIGURED");
  });

  it("detects a rollback when a relay withholds a newer rotation", async () => {
    const identity = await makeIdentity("relay-rollback");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    stale.seed(identity.bind.event);
    full.seed(identity.bind.event, rotation.event);

    const fresh = await resolveIdentity({ subject: identity.subject, relays: [full.url], now: NOW });
    expect(fresh.status).toBe("ACTIVE");
    expect(fresh.head?.record.payload.sequence).toBe(1);

    const rolledBack = await resolveIdentity({
      subject: identity.subject,
      relays: [stale.url],
      now: NOW,
      checkpoint: { sequence: 1, recordId: rotation.recordId },
    });
    expect(rolledBack.status).toBe("STALE");
    expect(rolledBack.reasonCode).toBe("ROLLBACK_DETECTED");
    expect(rolledBack.activeBch).toBeNull();
  });

  it("detects conflicting chains served by different relays", async () => {
    const identity = await makeIdentity("relay-conflict");
    const toB = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const toC = await rotate(identity, identity.bind, identity.bchA, identity.bchC, T0 + 61);
    stale.seed(identity.bind.event, toB.event);
    full.seed(identity.bind.event, toC.event);

    const result = await resolveIdentity({
      subject: identity.subject,
      relays: [full.url, stale.url],
      now: NOW,
    });
    expect(result.status).toBe("CONFLICT");
    expect(result.activeBch).toBeNull();
  });

  it("ignores a malformed KYVERA event from a hostile relay", async () => {
    const identity = await makeIdentity("relay-hostile");
    full.seed(identity.bind.event);
    // Correctly signed by the identity key, but not a valid KYVERA record.
    const forged = finalizeEvent(
      {
        kind: 30078,
        created_at: NOW - 10,
        tags: [["k", "kyvera-v1"]],
        content: '{"protocol":"kyvera"}',
      },
      identity.secret,
    ) as KyveraEvent;
    hostile.seed(forged);

    const result = await resolveIdentity({
      subject: identity.subject,
      relays: [full.url, hostile.url],
      now: NOW,
    });
    expect(result.status).toBe("ACTIVE");
    expect(result.rejected.length).toBeGreaterThan(0);
  });

  it("degrades to PARTIAL when a relay never sends EOSE", async () => {
    const silent = await LocalRelay.start({ omitEose: true });
    try {
      const identity = await makeIdentity("relay-no-eose");
      silent.seed(identity.bind.event);
      const result = await resolveIdentity({
        subject: identity.subject,
        relays: [silent.url],
        now: NOW,
        queryTimeoutMs: 1_200,
      });
      expect(result.status).toBe("ACTIVE");
      expect(result.assurance).toBe("PARTIAL");
    } finally {
      await silent.close();
    }
  });
});

describe("address resolution", () => {
  it("resolves a current address, a superseded address and a revoked address", async () => {
    const identity = await makeIdentity("address-resolution");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    full.seed(identity.bind.event, rotation.event);

    const current = await resolveAddress({
      address: identity.bchB.identity.address,
      relays: [full.url],
      now: NOW,
    });
    expect(current.status).toBe("ACTIVE");
    expect(current.bindings[0]?.subject).toBe(identity.subject);

    const old = await resolveAddress({
      address: identity.bchA.identity.address,
      relays: [full.url],
      now: NOW,
    });
    expect(old.status).toBe("SUPERSEDED");

    const revocation = await revoke(identity, rotation, identity.bchB);
    full.seed(revocation.event);
    const revoked = await resolveAddress({
      address: identity.bchB.identity.address,
      relays: [full.url],
      now: NOW,
    });
    expect(revoked.status).toBe("REVOKED");
  });

  it("returns UNKNOWN for an address with no binding", async () => {
    const identity = await makeIdentity("address-unknown");
    const result = await resolveAddress({
      address: identity.bchC.identity.address,
      relays: [full.url],
      now: NOW,
    });
    expect(result.status).toBe("UNKNOWN");
  });

  it("reports every identity that authorizes the same address", async () => {
    const alice = await makeIdentity("address-alice");
    const bob = await makeIdentity("address-bob");
    const shared = alice.bchC;
    const { createBindRecord } = await import("@kyvera/verifier");
    const aliceBind = await createBindRecord({
      signer: alice.signer,
      bchPrivateKey: shared.privateKey,
      bch: shared.identity,
      issuedAt: T0,
    });
    const bobBind = await createBindRecord({
      signer: bob.signer,
      bchPrivateKey: shared.privateKey,
      bch: shared.identity,
      issuedAt: T0,
    });
    full.seed(aliceBind.event, bobBind.event);
    const result = await resolveAddress({
      address: shared.identity.address,
      relays: [full.url],
      now: NOW,
    });
    expect(result.status).toBe("ACTIVE");
    expect(new Set(result.bindings.map((binding) => binding.subject))).toEqual(
      new Set([alice.subject, bob.subject]),
    );
  });

  it("rejects a malformed address without querying relays", async () => {
    const result = await resolveAddress({ address: "not-an-address", relays: [full.url], now: NOW });
    expect(result.status).toBe("INVALID");
    expect(result.bindings).toHaveLength(0);
  });
});
