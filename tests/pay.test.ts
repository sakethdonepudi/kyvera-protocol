import { describe, expect, it } from "vitest";
import {
  buildBip21Uri,
  checkPayable,
  destinationChanged,
  formatBchAmount,
  parseBchAmount,
} from "../apps/web/lib/pay.js";

const address = "bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen";

function resolution(overrides: Record<string, unknown> = {}) {
  return {
    status: "ACTIVE",
    assurance: "FULL",
    sync: { relays: [], responded: 2, total: 2, assurance: "FULL" },
    activeBch: { address, network: "mainnet", publicKey: null },
    ...overrides,
  } as never;
}

describe("payment amount parsing", () => {
  it("parses exact decimal amounts without floats", () => {
    expect(parseBchAmount("1.5")).toMatchObject({ ok: true, satoshis: 150_000_000n, bch: "1.5" });
    expect(parseBchAmount("0.00000001")).toMatchObject({ ok: true, satoshis: 1n });
    expect(parseBchAmount("21000000")).toMatchObject({ ok: true, satoshis: 2_100_000_000_000_000n });
    expect(parseBchAmount("")).toMatchObject({ ok: true, satoshis: 0n });
  });

  it("rejects malformed, negative, zero and over-supply amounts", () => {
    for (const value of ["-1", "0", "1e-3", "1.123456789", "abc", "1,5", "21000001"]) {
      expect(parseBchAmount(value).ok, value).toBe(false);
    }
  });

  it("formats satoshis without trailing zeroes", () => {
    expect(formatBchAmount(150_000_000n)).toBe("1.5");
    expect(formatBchAmount(1n)).toBe("0.00000001");
    expect(formatBchAmount(100_000_000n)).toBe("1");
  });
});

describe("BIP21 payment URI", () => {
  it("encodes address, amount, label and message", () => {
    const uri = buildBip21Uri({
      address,
      amountBch: "0.001",
      label: "Alice",
      message: "Invoice 42",
    });
    expect(uri).toBe(
      "bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen?amount=0.001&label=Alice&message=Invoice%2042",
    );
  });

  it("supports an open amount", () => {
    expect(buildBip21Uri({ address })).toBe(
      "bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen",
    );
  });
});

describe("payment policy", () => {
  it("allows an ACTIVE identity on the expected network", () => {
    expect(checkPayable(resolution(), "mainnet")).toMatchObject({ ok: true, code: "OK" });
  });

  it("warns on partial relay synchronization but still allows", () => {
    const result = checkPayable(
      resolution({
        assurance: "PARTIAL",
        sync: { relays: [], responded: 1, total: 2, assurance: "PARTIAL" },
      }),
      "mainnet",
    );
    expect(result.ok).toBe(true);
    expect(result.warning).toMatch(/1\/2 relays/);
  });

  it("blocks stale, revoked, conflicted, expired and unknown identities", () => {
    for (const status of ["STALE", "REVOKED", "CONFLICT", "EXPIRED", "UNKNOWN", "INVALID", "SUPERSEDED"]) {
      const result = checkPayable(resolution({ status, activeBch: status === "EXPIRED" ? { address, network: "mainnet", publicKey: null } : null }), "mainnet");
      expect(result.ok, status).toBe(false);
    }
  });

  it("blocks UNSYNCED assurance even if status says ACTIVE", () => {
    const result = checkPayable(
      resolution({ assurance: "UNSYNCED", sync: { relays: [], responded: 0, total: 2, assurance: "UNSYNCED" } }),
      "mainnet",
    );
    expect(result).toMatchObject({ ok: false, code: "UNSYNCED" });
  });

  it("blocks the wrong network", () => {
    expect(checkPayable(resolution(), "chipnet")).toMatchObject({ ok: false, code: "NETWORK_MISMATCH" });
  });
});

describe("destination change detection", () => {
  const snapshot = { subject: "a".repeat(64), address, status: "ACTIVE" as const };

  it("detects address, subject and status changes", () => {
    expect(destinationChanged(snapshot, snapshot)).toBe(false);
    expect(destinationChanged(snapshot, { ...snapshot, address: "bitcoincash:qother" })).toBe(true);
    expect(destinationChanged(snapshot, { ...snapshot, subject: "b".repeat(64) })).toBe(true);
    expect(destinationChanged(snapshot, { ...snapshot, status: "REVOKED" })).toBe(true);
    expect(destinationChanged(null, snapshot)).toBe(true);
  });
});
