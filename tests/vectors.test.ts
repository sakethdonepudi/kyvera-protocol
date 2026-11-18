import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalize, recordDigest, sha256Hex, type KyveraEvent } from "@kyvera/core";
import { hashBitcoinMessage, verifyBitcoinMessageSignature } from "@kyvera/bch";
import { parseRecordEvent } from "@kyvera/nostr";
import { resolveEvents, verifyEventRecord } from "@kyvera/verifier";

interface VectorFile {
  spec: string;
  subject: string;
  canonical: Array<{ name: string; value: unknown; canonical: string; sha256: string }>;
  bchMessage: { message: string; hash: string; address: string; signature: string };
  records: Array<{
    name: string;
    event: KyveraEvent;
    recordId?: string;
    payloadDigest?: string;
    verify: { ok: boolean; code?: string };
  }>;
  chains: Array<{
    name: string;
    events: KyveraEvent[];
    now: number;
    expect: { status: string; sequence: number | null; address: string | null };
  }>;
}

const vectors = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/vectors.json", import.meta.url)), "utf8"),
) as VectorFile;

describe("published test vectors", () => {
  it("has the expected spec identifier", () => {
    expect(vectors.spec).toBe("kyvera-test-vectors-v1");
  });

  it("reproduces every canonical encoding and digest", () => {
    for (const sample of vectors.canonical) {
      expect(canonicalize(sample.value), sample.name).toBe(sample.canonical);
      expect(sha256Hex(new TextEncoder().encode(sample.canonical)), sample.name).toBe(sample.sha256);
    }
  });

  it("reproduces the wallet signmessage hash and signature", () => {
    const { message, hash, address, signature } = vectors.bchMessage;
    expect(Buffer.from(hashBitcoinMessage(message)).toString("hex")).toBe(hash);
    const check = verifyBitcoinMessageSignature(address, message, signature);
    expect(check.ok).toBe(true);
  });

  it("verifies every record vector and its declared digest", () => {
    for (const vector of vectors.records) {
      const result = verifyEventRecord(vector.event, { now: 1_794_003_600 });
      expect(result.ok, `${vector.name}: ${result.code} ${result.message}`).toBe(vector.verify.ok);
      if (!vector.verify.ok) expect(result.code).toBe(vector.verify.code);

      if (vector.recordId) {
        const parsed = parseRecordEvent(vector.event);
        expect(parsed.ok).toBe(true);
        expect(recordDigest(parsed.record!)).toBe(vector.recordId);
        expect(parsed.payloadDigest).toBe(vector.payloadDigest);
      }
    }
  });

  it("resolves every chain vector to the published state", () => {
    for (const chain of vectors.chains) {
      const { resolution } = resolveEvents(chain.events, { now: chain.now });
      expect(resolution.status, chain.name).toBe(chain.expect.status);
      if (chain.expect.sequence !== null) {
        expect(resolution.head?.record.payload.sequence, chain.name).toBe(chain.expect.sequence);
      }
      expect(resolution.activeBch?.address ?? null, chain.name).toBe(chain.expect.address);
    }
  });
});
