import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  CanonicalizationError,
  canonicalize,
  isCanonicalJson,
} from "@kyvera/core";
import { parseRecordEvent } from "@kyvera/nostr";
import { finalizeEvent } from "nostr-tools/pure";
import { verifyEventRecord, resolveEvents } from "@kyvera/verifier";
import type { KyveraEvent } from "@kyvera/core";
import { T0, makeIdentity, revoke, rotate, type TestIdentity } from "./helpers.js";

const NOW = T0 + 3600;

/* A value domain exactly matching KCJ-1: null, booleans, safe integers,
 * strings, arrays and plain objects. */
const kcjValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  node: fc.oneof(
    fc.constant(null),
    fc.boolean(),
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    fc.string(),
    fc.array(tie("node") as fc.Arbitrary<unknown>, { maxLength: 3 }),
    fc.dictionary(
      fc.stringMatching(/^[a-z0-9_]{1,8}$/),
      tie("node") as fc.Arbitrary<unknown>,
      { maxKeys: 3 },
    ),
  ),
})).node as fc.Arbitrary<unknown>;

describe("canonical JSON properties", () => {
  it("is idempotent and accepts its own canonical output", () => {
    fc.assert(
      fc.property(kcjValue, (value) => {
        const canonical = canonicalize(value);
        const reparsed = JSON.parse(canonical);
        expect(canonicalize(reparsed)).toBe(canonical);
        expect(isCanonicalJson(canonical)).toBe(true);
      }),
      { numRuns: 150 },
    );
  });

  it("is independent of object insertion order", () => {
    fc.assert(
      fc.property(kcjValue, (value) => {
        const canonical = canonicalize(value);
        const parsed = JSON.parse(canonical);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
        const reversed = Object.fromEntries(Object.entries(parsed).reverse());
        expect(canonicalize(reversed)).toBe(canonical);
      }),
      { numRuns: 100 },
    );
  });

  it("normalizes strings to NFC before signing", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(canonicalize({ text })).toBe(canonicalize({ text: text.normalize("NFC") }));
      }),
      { numRuns: 100 },
    );
  });

  it("rejects floats, unsafe integers, non-finite numbers and undefined", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }).filter((number) => !Number.isInteger(number)),
        (number) => {
          expect(() => canonicalize({ number })).toThrow(CanonicalizationError);
        },
      ),
      { numRuns: 50 },
    );
    expect(() => canonicalize({ n: Number.MAX_SAFE_INTEGER + 1 })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ n: Number.POSITIVE_INFINITY })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ n: Number.NaN })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ n: undefined })).toThrow(CanonicalizationError);
  });

  it("normalizes negative zero and accepts safe integer boundaries", () => {
    expect(canonicalize({ n: -0 })).toBe('{"n":0}');
    expect(canonicalize({ n: Number.MAX_SAFE_INTEGER })).toBe(`{"n":9007199254740991}`);
    expect(canonicalize({ n: Number.MIN_SAFE_INTEGER })).toBe(`{"n":-9007199254740991}`);
  });

  it("rejects duplicate keys and non-canonical whitespace", () => {
    expect(isCanonicalJson('{"a":1,"a":2}')).toBe(false);
    expect(isCanonicalJson('{"a": 1}')).toBe(false);
    expect(isCanonicalJson('{"a":1}')).toBe(true);
  });

  it("bounds nesting depth and huge inputs", () => {
    let deep: unknown = "leaf";
    for (let index = 0; index < 40; index += 1) deep = [deep];
    expect(() => canonicalize(deep)).toThrow(CanonicalizationError);
    expect(() => canonicalize({ text: "x".repeat(200_000) })).not.toThrow();
  });
});

describe("authorization chain properties", () => {
  let identity: TestIdentity;
  let events: KyveraEvent[];
  let validEvents: KyveraEvent[];

  beforeAll(async () => {
    identity = await makeIdentity("property-chain");
    const rotation = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 60);
    const revocation = await revoke(identity, rotation, identity.bchB, T0 + 120);
    const conflict = await rotate(identity, identity.bind, identity.bchA, identity.bchC, T0 + 61);
    const gap = await rotate(identity, identity.bind, identity.bchA, identity.bchB, T0 + 120);
    // gap uses sequence 1 but references a different predecessor after mutation below
    const gapRecord = JSON.parse(JSON.stringify(gap.record)) as typeof gap.record;
    gapRecord.payload.sequence = 2;
    const gapEvent = { ...gap.event, content: canonicalize(gapRecord) };
    validEvents = [identity.bind.event, rotation.event, revocation.event];
    events = [identity.bind.event, rotation.event, revocation.event, conflict.event, gapEvent];
  });

  it("never throws for any subset or ordering of real events", () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(events, { minLength: 0 }), (subset) => {
        const { resolution } = resolveEvents(subset, { now: NOW });
        expect([
          "ACTIVE",
          "SUPERSEDED",
          "REVOKED",
          "EXPIRED",
          "CONFLICT",
          "STALE",
          "UNKNOWN",
          "INVALID",
        ]).toContain(resolution.status);
        expect(resolution.checkedAt).toBe(NOW);
      }),
      { numRuns: 60 },
    );
  });

  it("only asserts a current address for conclusive current states", () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(validEvents, { minLength: 0 }), (subset) => {
        const { resolution } = resolveEvents(subset, { now: NOW });
        if (resolution.activeBch) {
          expect(["ACTIVE", "EXPIRED"]).toContain(resolution.status);
        }
        if (resolution.status === "REVOKED") expect(resolution.activeBch).toBeNull();
        if (resolution.status === "CONFLICT") expect(resolution.activeBch).toBeNull();
        if (resolution.status === "STALE") expect(resolution.activeBch).toBeNull();
        if (resolution.status === "INVALID") expect(resolution.activeBch).toBeNull();
      }),
      { numRuns: 70 },
    );
  });

  it("keeps every accepted chain internally consistent", () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(validEvents, { minLength: 1 }), (subset) => {
        const { resolution } = resolveEvents(subset, { now: NOW });
        if (resolution.status !== "ACTIVE" && resolution.status !== "REVOKED") return;
        let previous: string | null = null;
        for (const [index, step] of resolution.history.entries()) {
          const payload = step.record.payload;
          expect(payload.sequence).toBe(index);
          expect(payload.previous).toBe(previous);
          previous = step.recordId;
          expect(verifyEventRecord(step.event!, { now: NOW }).ok).toBe(true);
        }
        if (resolution.status === "ACTIVE") {
          expect(resolution.activeBch?.address).toBe(resolution.head?.record.payload.bch?.address);
        }
      }),
      { numRuns: 50 },
    );
  });

  it("never throws on mutated event metadata", () => {
    const event = fc.record({
      id: fc.string({ maxLength: 80 }),
      pubkey: fc.string({ maxLength: 80 }),
      created_at: fc.integer({ min: -1_000_000, max: 4_000_000_000 }),
      kind: fc.integer({ min: -10, max: 40000 }),
      tags: fc.array(fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }), { maxLength: 6 }),
      content: fc.string({ maxLength: 500 }),
      sig: fc.string({ maxLength: 140 }),
    });
    fc.assert(
      fc.property(event, (candidate) => {
        const forged = candidate as unknown as KyveraEvent;
        expect(() => parseRecordEvent(forged)).not.toThrow();
        expect(() => verifyEventRecord(forged, { now: NOW })).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it("rejects oversized event content without unbounded work", () => {
    const oversized = finalizeEvent(
      {
        kind: 30078,
        created_at: identity.bind.event.created_at,
        tags: identity.bind.event.tags,
        content: `{"payload":"${"x".repeat(20_000)}"}`,
      },
      identity.secret,
    ) as KyveraEvent;
    const result = verifyEventRecord(oversized, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CONTENT_LENGTH");
  });
});
