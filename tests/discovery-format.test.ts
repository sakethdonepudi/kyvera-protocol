import { describe, expect, it } from "vitest";
import { finalizeEvent } from "nostr-tools/pure";
import {
  NOSTR_D_PREFIX,
  NOSTR_KINDS,
  NOSTR_KIND,
  NOSTR_PUBLIC_KIND,
  type KyveraEvent,
} from "@kyvera/core";
import { addressFilter, parseRecordEvent, subjectFilter } from "@kyvera/nostr";
import { resolveEvents } from "@kyvera/verifier";
import { makeIdentity, revoke, rotate, T0 } from "./helpers";

describe("public discovery format", () => {
  it("uses a regular-event public kind and preserves the NIP-78 legacy mirror", async () => {
    const identity = await makeIdentity("v5-discovery");
    expect(NOSTR_PUBLIC_KIND).toBeGreaterThanOrEqual(1000);
    expect(NOSTR_PUBLIC_KIND).toBeLessThan(10000);
    expect(NOSTR_KIND).toBe(30078);
    expect([...NOSTR_KINDS]).toEqual([NOSTR_PUBLIC_KIND, NOSTR_KIND]);
    expect(identity.bind.publicEvent.kind).toBe(NOSTR_PUBLIC_KIND);
    expect(identity.bind.event.kind).toBe(NOSTR_KIND);
  });

  it("gives every lifecycle record a unique d tag committed to subject, sequence and payload digest", async () => {
    const identity = await makeIdentity("v5-dtags");
    const rotated = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const revoked = await revoke(identity, rotated, identity.bchB);

    const records = [identity.bind, rotated, revoked];
    const dTags = records.map((entry) => {
      const matches = entry.publicEvent.tags.filter((tag) => tag[0] === "d");
      expect(matches).toHaveLength(1);
      return matches[0]![1]!;
    });

    expect(new Set(dTags).size).toBe(3);
    for (const [index, entry] of records.entries()) {
      expect(dTags[index]!.startsWith(`${NOSTR_D_PREFIX}:${identity.subject}:${index}:`)).toBe(true);
      expect(dTags[index]!.endsWith(entry.payloadDigest)).toBe(true);
    }

    // Regular events are never replaced by addressable-event rules. A store
    // keyed the way NIP-01 addressable events are keyed still sees three
    // distinct records because every d tag is unique.
    const store = new Map<string, KyveraEvent>();
    for (const entry of records) {
      store.set(`${entry.publicEvent.pubkey}:${entry.publicEvent.kind}:${dTags[records.indexOf(entry)]}`, entry.publicEvent);
    }
    expect(store.size).toBe(3);
  });

  it("parses both envelopes and rejects unrelated kinds", async () => {
    const identity = await makeIdentity("v5-parse");
    expect(parseRecordEvent(identity.bind.event).ok).toBe(true);
    expect(parseRecordEvent(identity.bind.publicEvent).ok).toBe(true);

    const wrongKind = finalizeEvent(
      {
        kind: 1,
        created_at: identity.bind.publicEvent.created_at,
        tags: identity.bind.publicEvent.tags,
        content: identity.bind.publicEvent.content,
      },
      identity.secret,
    ) as KyveraEvent;
    const parsed = parseRecordEvent(wrongKind);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe("NOSTR_KIND_INVALID");
  });

  it("rejects a public event whose d tag does not commit to the record", async () => {
    const identity = await makeIdentity("v5-tamper");
    const tags = identity.bind.publicEvent.tags.map((tag) =>
      tag[0] === "d" ? ["d", `${tag[1]}-tampered`] : tag,
    );
    const tampered = finalizeEvent(
      {
        kind: identity.bind.publicEvent.kind,
        created_at: identity.bind.publicEvent.created_at,
        tags,
        content: identity.bind.publicEvent.content,
      },
      identity.secret,
    ) as KyveraEvent;
    const parsed = parseRecordEvent(tampered);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe("D_TAG_INVALID");
  });

  it("queries both public and legacy kinds with the indexed k/b tags", async () => {
    const identity = await makeIdentity("v5-filters");
    const subject = subjectFilter(identity.subject);
    const address = addressFilter(identity.bchA.identity.address);
    expect(subject.kinds).toEqual([...NOSTR_KINDS]);
    expect(subject["#k"]).toEqual(["kyvera-v1"]);
    expect(address.kinds).toEqual([...NOSTR_KINDS]);
    expect(address["#k"]).toEqual(["kyvera-v1"]);
    expect(address["#b"]).toEqual([identity.bchA.identity.address.toLowerCase()]);
  });

  it("reconstructs a full lifecycle from public events alone", async () => {
    const identity = await makeIdentity("v5-resolve");
    const rotated = await rotate(identity, identity.bind, identity.bchA, identity.bchB);
    const revoked = await revoke(identity, rotated, identity.bchB);

    const active = resolveEvents([identity.bind.publicEvent, rotated.publicEvent], {
      now: T0 + 3_600,
    }).resolution;
    expect(active.status).toBe("ACTIVE");
    expect(active.activeBch?.address).toBe(identity.bchB.identity.address);
    expect(active.superseded.some((entry) => entry.address === identity.bchA.identity.address)).toBe(true);

    const ended = resolveEvents(
      [identity.bind.publicEvent, rotated.publicEvent, revoked.publicEvent],
      { now: T0 + 3_600 },
    ).resolution;
    expect(ended.status).toBe("REVOKED");
    expect(ended.activeBch).toBeNull();
    expect(ended.history).toHaveLength(3);
  });
});
