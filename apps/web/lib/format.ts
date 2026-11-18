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
  return new Date(seconds * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      return "border-accent/40 bg-accent/10 text-accent-bright";
    case "SUPERSEDED":
    case "EXPIRED":
    case "STALE":
      return "border-amber-400/35 bg-amber-400/10 text-amber-300";
    case "REVOKED":
    case "CONFLICT":
    case "INVALID":
      return "border-rose-400/35 bg-rose-400/10 text-rose-300";
    default:
      return "border-white/15 bg-white/5 text-slate-300";
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
