import { describe, expect, it } from "vitest";
import { KyveraClient, KyveraSdkError, toVerificationResult } from "@kyvera/sdk";
import { resolveEvents } from "@kyvera/verifier";
import { makeIdentity, revoke, rotate, T0 } from "./helpers";

function withSync(resolution: ReturnType<typeof resolveEvents>["resolution"], assurance: "FULL" | "PARTIAL" | "UNSYNCED") {
  return {
    ...resolution,
    assurance,
    sync: {
      relays: [
        { url: "wss://one.example", ok: true, eose: assurance === "FULL", events: 1, latencyMs: 10 },
        { url: "wss://two.example", ok: assurance !== "UNSYNCED", eose: assurance === "FULL", events: 0, latencyMs: 20 },
      ],
      responded: assurance === "UNSYNCED" ? 0 : assurance === "FULL" ? 2 : 1,
      total: 2,
      assurance,
    },
    sources: {},
  };
}

describe("@kyvera/sdk", () => {
  it("returns structured authorization and evidence for an active lifecycle", async () => {
    const identity = await makeIdentity("sdk-active");
    const rotated = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const resolution = withSync(
      resolveEvents([identity.bind.event, rotated.event], { now: T0 + 3_600 }).resolution,
      "FULL",
    );
    const result = toVerificationResult(resolution, identity.bind.publicEvent.pubkey);

    expect(result.protocol).toBe("kyvera");
    expect(result.status).toBe("ACTIVE");
    expect(result.cryptographicValidity).toBe(true);
    expect(result.historicalValidity.valid).toBe(true);
    expect(result.historicalValidity.records).toHaveLength(2);
    expect(result.currentAuthorization.authorized).toBe(true);
    expect(result.currentAuthorization.usableForSensitiveOperations).toBe(true);
    expect(result.currentAuthorization.address).toBe(identity.bchB.identity.address);
    expect(result.evidenceCompleteness.assurance).toBe("FULL");
    expect(result.checks.find((check) => check.id === "full_relay_agreement")?.ok).toBe(true);
  });

  it("keeps current authorization separate from evidence completeness", async () => {
    const identity = await makeIdentity("sdk-partial");
    const resolution = withSync(
      resolveEvents([identity.bind.event], { now: T0 + 3_600 }).resolution,
      "PARTIAL",
    );
    const result = toVerificationResult(resolution, identity.subject);
    expect(result.status).toBe("ACTIVE");
    expect(result.currentAuthorization.authorized).toBe(true);
    expect(result.currentAuthorization.usableForSensitiveOperations).toBe(false);
    expect(result.evidenceCompleteness.full).toBe(false);
  });

  it("does not present a revoked identity as authorized", async () => {
    const identity = await makeIdentity("sdk-revoked");
    const rotated = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const revoked = await revoke(identity, rotated, identity.bchB);
    const resolution = withSync(
      resolveEvents([identity.bind.event, rotated.event, revoked.event], { now: T0 + 3_600 }).resolution,
      "FULL",
    );
    const result = toVerificationResult(resolution, identity.subject);
    expect(result.status).toBe("REVOKED");
    expect(result.currentAuthorization.authorized).toBe(false);
    expect(result.currentAuthorization.address).toBeNull();
    expect(result.historicalValidity.records).toHaveLength(3);
  });

  it("keeps cryptographic validity when a forged candidate is rejected", async () => {
    const identity = await makeIdentity("sdk-forged");
    const rotated = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const revoked = await revoke(identity, rotated, identity.bchB);
    const base = withSync(
      resolveEvents([identity.bind.event, rotated.event, revoked.event], { now: T0 + 3_600 }).resolution,
      "FULL",
    );
    const result = toVerificationResult(
      {
        ...base,
        rejected: [
          { eventId: "forged", code: "BCH_SIGNATURE_NOT_BY_ADDRESS", message: "forged current proof" },
        ],
      },
      identity.subject,
    );
    expect(result.status).toBe("REVOKED");
    expect(result.cryptographicValidity).toBe(true);
    expect(result.historicalValidity.valid).toBe(true);
    expect(result.currentAuthorization.authorized).toBe(false);
    expect(result.checks.find((check) => check.id === "candidate_rejections")?.ok).toBe(false);
  });

  it("rejects an invalid subject with a typed error", async () => {
    const client = new KyveraClient({ relays: [] });
    await expect(client.resolve("not-a-key")).rejects.toBeInstanceOf(KyveraSdkError);
    await expect(client.resolve("not-a-key")).rejects.toMatchObject({ code: "INVALID_SUBJECT" });
  });

  it("reports UNSYNCED when no relay is configured", async () => {
    const identity = await makeIdentity("sdk-offline");
    const client = new KyveraClient({ relays: [], now: T0 + 3_600 });
    const result = await client.verify(identity.subject);
    expect(result.status).toBe("STALE");
    expect(result.evidenceCompleteness.assurance).toBe("UNSYNCED");
    expect(result.currentAuthorization.authorized).toBe(false);
  });

  it("verifies one record and exports evidence without private keys", async () => {
    const identity = await makeIdentity("sdk-record");
    const client = new KyveraClient({ relays: [], now: T0 + 3_600 });
    const checked = client.verifyRecord(identity.bind.publicEvent);
    expect(checked.ok).toBe(true);

    const resolution = withSync(
      resolveEvents([identity.bind.event], { now: T0 + 3_600 }).resolution,
      "FULL",
    );
    const result = toVerificationResult(resolution, identity.subject);
    const evidence = client.exportEvidence(result);
    expect(evidence).toContain("kyvera-evidence");
    expect(evidence).not.toContain("privateKey");
    expect(evidence).not.toContain("nostrSecret");
  });
});
