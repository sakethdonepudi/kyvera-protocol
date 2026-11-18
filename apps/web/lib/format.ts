import type { IdentityStatus } from "@kyvera/core";

export function shortHex(value: string, front = 8, back = 6): string {
  if (value.length <= front + back + 2) return value;
  return `${value.slice(0, front)}…${value.slice(-back)}`;
}

export function shortAddress(address: string | null | undefined): string {
  if (!address) return "—";
  const [prefix, payload] = address.split(":");
  return `${prefix}:${shortHex(payload ?? "", 8, 6)}`;
}

export function shortNpub(npub: string): string {
  return shortHex(npub, 12, 8);
}

export function timestamp(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(seconds * 1000)) + " UTC";
}

/** Compact UTC timestamp for narrow metric cells. */
export function timestampShort(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(seconds * 1000));
}

export function relativeTime(seconds: number): string {
  const delta = Math.floor(Date.now() / 1000) - seconds;
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
}

export const STATUS_LABEL: Record<IdentityStatus, string> = {
  ACTIVE: "Active",
  SUPERSEDED: "Superseded",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
  CONFLICT: "Conflict",
  STALE: "Stale",
  UNKNOWN: "Unknown",
  INVALID: "Invalid",
};

export function statusClasses(status: IdentityStatus): string {
  switch (status) {
    case "ACTIVE":
      return "border-accent/45 bg-accent/[0.08] text-accent-bright";
    case "SUPERSEDED":
      return "border-signal/45 bg-signal/[0.06] text-signal-bright";
    case "EXPIRED":
      return "border-ivory/25 bg-ivory/[0.03] text-ivory-dim";
    case "STALE":
      return "border-signal/35 bg-signal/[0.04] text-[#F0B39E]";
    case "REVOKED":
    case "CONFLICT":
    case "INVALID":
      return "border-danger/45 bg-danger/[0.06] text-[#E5A49C]";
    default:
      return "border-ivory/18 bg-ivory/[0.02] text-ivory-muted";
  }
}

export const CATEGORY: Record<IdentityStatus, string> = {
  ACTIVE: "Current authorization",
  SUPERSEDED: "Historical binding",
  REVOKED: "Explicitly revoked",
  EXPIRED: "Authorization expired",
  CONFLICT: "Equivocation detected",
  STALE: "Insufficient history",
  UNKNOWN: "No records",
  INVALID: "Failed verification",
};
