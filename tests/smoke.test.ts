import { describe, expect, it } from "vitest";
import { makeIdentity, verifyAt, T0 } from "./helpers.js";
import { parseRecordEvent } from "@kyvera/nostr";

describe("smoke", () => {
  it("creates and verifies a dual-key binding", async () => {
    const identity = await makeIdentity("smoke");
    expect(identity.bind.event.pubkey).toBe(identity.subject);
    const parsed = parseRecordEvent(identity.bind.event);
    expect(parsed).toMatchObject({ ok: true });
    const verified = verifyAt(identity.bind.event, T0 + 60);
    expect(verified).toMatchObject({ ok: true });
  });
});
