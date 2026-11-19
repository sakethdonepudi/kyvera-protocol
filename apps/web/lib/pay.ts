import type { BchNetwork, IdentityStatus } from "@kyvera/core";
import type { IdentityResolution } from "@kyvera/verifier";
import { decodeP2pkhAddress } from "@kyvera/bch";

export interface AmountCheck {
  ok: boolean;
  code: string;
  message: string;
  satoshis?: bigint;
  bch?: string;
}

/** Parses a decimal BCH amount without floating-point arithmetic. */
export function parseBchAmount(input: string): AmountCheck {
  const text = input.trim();
  if (!text) return { ok: true, code: "EMPTY", message: "Open amount", satoshis: 0n, bch: "" };
  if (!/^\d+(\.\d{1,8})?$/.test(text)) {
    return { ok: false, code: "AMOUNT_FORMAT", message: "Use a positive decimal with at most 8 places." };
  }
  const [whole, fraction = ""] = text.split(".");
  const satoshis = BigInt(whole!) * 100_000_000n + BigInt((fraction + "00000000").slice(0, 8));
  if (satoshis <= 0n) return { ok: false, code: "AMOUNT_ZERO", message: "Amount must be greater than zero." };
  if (satoshis > 21_000_000n * 100_000_000n) {
    return { ok: false, code: "AMOUNT_TOO_LARGE", message: "Amount exceeds the BCH supply." };
  }
  const normalized = formatBchAmount(satoshis);
  return { ok: true, code: "OK", message: "ok", satoshis, bch: normalized };
}

export function formatBchAmount(satoshis: bigint): string {
  const whole = satoshis / 100_000_000n;
  const fraction = (satoshis % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export interface Bip21Input {
  address: string;
  amountBch?: string;
  label?: string;
  message?: string;
}

/** Builds a BIP21 payment URI supported by Paytaca, Electron Cash, Cashonize and others. */
export function buildBip21Uri(input: Bip21Input): string {
  const params: string[] = [];
  if (input.amountBch) params.push(`amount=${encodeURIComponent(input.amountBch)}`);
  if (input.label?.trim()) params.push(`label=${encodeURIComponent(input.label.trim())}`);
  if (input.message?.trim()) params.push(`message=${encodeURIComponent(input.message.trim())}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return `bitcoincash:${input.address.replace(/^bitcoincash:/, "")}${query}`;
}

export interface PayCheck {
  ok: boolean;
  code: string;
  message: string;
  warning?: string;
}

/**
 * Payment policy: fail closed. A destination is payable only when every
 * configured relay responded with EOSE (`FULL`), the state is ACTIVE, and the
 * address is a valid P2PKH address on the expected network. PARTIAL/UNSYNCED
 * states are not payable because a relay set may be withholding a newer
 * rotation or revocation.
 */
export function checkPayable(
  resolution: Pick<IdentityResolution, "status" | "activeBch" | "assurance" | "sync">,
  network: BchNetwork,
): PayCheck {
  if (resolution.status !== "ACTIVE") {
    return {
      ok: false,
      code: `STATUS_${resolution.status}`,
      message:
        resolution.status === "STALE"
          ? "The current state could not be established from relays. Payment blocked."
          : resolution.status === "CONFLICT"
            ? "This identity published conflicting authorizations. Payment blocked."
            : resolution.status === "REVOKED"
              ? "This identity has been revoked. Payment blocked."
              : resolution.status === "EXPIRED"
                ? "This binding has expired. Payment blocked."
                : `Identity is not ACTIVE (${resolution.status}). Payment blocked.`,
    };
  }
  if (!resolution.activeBch) {
    return { ok: false, code: "NO_ADDRESS", message: "The verifier asserted no current payment address." };
  }
  if (resolution.activeBch.network !== network) {
    return {
      ok: false,
      code: "NETWORK_MISMATCH",
      message: `Identity is on ${resolution.activeBch.network}, but this app is set to ${network}.`,
    };
  }
  const decoded = decodeP2pkhAddress(resolution.activeBch.address);
  if (typeof decoded === "string") {
    return { ok: false, code: "ADDRESS_INVALID", message: `Current address is invalid: ${decoded}` };
  }
  if (decoded.network !== network) {
    return { ok: false, code: "NETWORK_MISMATCH", message: "Address network does not match the app network." };
  }
  if (resolution.assurance === "UNSYNCED") {
    return {
      ok: false,
      code: "UNSYNCED",
      message: "No relay responded; the destination cannot be verified. Payment blocked.",
    };
  }
  if (resolution.assurance !== "FULL") {
    return {
      ok: false,
      code: "PARTIAL_SYNC",
      message: `Only ${resolution.sync.responded}/${resolution.sync.total} relays responded. Payment requires full relay agreement.`,
    };
  }
  return { ok: true, code: "OK", message: "Destination is currently authorized." };
}

export interface DestinationSnapshot {
  subject: string;
  address: string;
  status: IdentityStatus;
  /** Last observed head, used to detect a rollback after the intent was formed. */
  headSequence?: number | null;
  headRecordId?: string | null;
}

export function destinationChanged(
  previous: DestinationSnapshot | null,
  next: DestinationSnapshot | null,
): boolean {
  if (!previous || !next) return true;
  if (
    previous.subject !== next.subject ||
    previous.address !== next.address ||
    previous.status !== "ACTIVE" ||
    next.status !== "ACTIVE"
  ) {
    return true;
  }
  if (
    typeof previous.headSequence === "number" &&
    typeof next.headSequence === "number" &&
    next.headSequence < previous.headSequence
  ) {
    return true;
  }
  if (
    previous.headSequence !== undefined &&
    previous.headSequence === next.headSequence &&
    previous.headRecordId &&
    next.headRecordId &&
    previous.headRecordId !== next.headRecordId
  ) {
    return true;
  }
  return false;
}
