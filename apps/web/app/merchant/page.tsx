"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { resolveEvents, verifyEventRecord } from "@kyvera/verifier";
import { LAB_NOW, getDemoState, type DemoState } from "@/lib/lab";
import { shortAddress, shortHex } from "@/lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  SectionLabel,
  Spinner,
  StatusBadge,
  cn,
} from "@/components/ui";

type Phase = "unverified" | "verified" | "rotated";

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export default function MerchantPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("unverified");
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDemoState()
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolution = useMemo(() => {
    if (!state) return null;
    if (phase === "rotated") {
      return resolveEvents([state.fixtures.bind.event, state.fixtures.rotateB.event], {
        now: LAB_NOW,
      }).resolution;
    }
    return state.bind;
  }, [state, phase]);

  const destination = phase === "unverified" ? null : resolution?.activeBch?.address ?? null;

  function verifyMerchant() {
    if (!state) return;
    setBusy(true);
    setError("");
    try {
      const proof = verifyEventRecord(state.fixtures.bind.event, { now: LAB_NOW });
      const nextChecks: Check[] = [
        {
          label: "Merchant BCH proof verifies",
          ok: proof.ok === true,
          detail: proof.ok ? "signmessage recovery matched wallet A" : proof.code,
        },
        {
          label: "Merchant Nostr proof verifies",
          ok: proof.ok === true,
          detail: proof.ok ? "BIP-340 signature accepted" : proof.message,
        },
        {
          label: "Authorization chain is ACTIVE",
          ok: state.bind.status === "ACTIVE",
          detail: `${state.bind.status} · ${state.bind.reason}`,
        },
        {
          label: "Current wallet asserted",
          ok: state.bind.activeBch?.address === state.fixtures.walletA.identity.address,
          detail: state.bind.activeBch?.address ?? "none",
        },
      ];
      setChecks(nextChecks);
      setPhase(nextChecks.every((check) => check.ok) ? "verified" : "unverified");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function rotateMerchant() {
    if (!state) return;
    setBusy(true);
    setError("");
    try {
      const rotation = resolveEvents([state.fixtures.bind.event, state.fixtures.rotateB.event], {
        now: LAB_NOW,
      }).resolution;
      const proof = verifyEventRecord(state.fixtures.rotateB.event, { now: LAB_NOW });
      const oldAddress = state.fixtures.walletA.identity.address;
      const nextChecks: Check[] = [
        {
          label: "Rotation record verifies",
          ok: proof.ok === true,
          detail: proof.ok ? "old key, new key and Nostr signature" : proof.code,
        },
        {
          label: "New wallet is current",
          ok: rotation.activeBch?.address === state.fixtures.walletB.identity.address,
          detail: rotation.activeBch?.address ?? "none",
        },
        {
          label: "Old wallet is superseded",
          ok: rotation.superseded.some((entry) => entry.address === oldAddress),
          detail: oldAddress,
        },
        {
          label: "Chain remains ACTIVE",
          ok: rotation.status === "ACTIVE",
          detail: `${rotation.status} · ${rotation.reason}`,
        },
      ];
      setChecks(nextChecks);
      setPhase(nextChecks.every((check) => check.ok) ? "rotated" : "verified");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("unverified");
    setChecks([]);
    setError("");
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10">
      <div className="max-w-2xl">
        <div className="kicker text-signal">Merchant identity demonstration</div>
        <h1 className="mt-3 font-display text-[36px] leading-[1.04] tracking-editorial text-ivory sm:text-[46px]">
          The payment address
          <br />
          follows the identity.
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ivory-dim">
          A self-asserted demo merchant. No third-party attestation is claimed.
        </p>
      </div>

      {error ? (
        <div className="mt-5">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7b07a] text-[15px] font-bold text-charcoal-950">
                  S
                </div>
                <div>
                  <div className="font-display text-[22px] leading-none text-ivory">Sawa Market</div>
                  <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ivory-muted">
                    Demo merchant · self-asserted
                  </div>
                </div>
              </div>
              <Badge tone={phase === "unverified" ? "neutral" : "accent"}>
                {phase === "unverified" ? "unverified" : phase === "verified" ? "verified" : "rotated"}
              </Badge>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Fact label="Nostr identity" value={state ? shortHex(state.fixtures.subject, 18, 10) : "—"} />
              <Fact label="Current BCH" value={resolution?.activeBch?.address ?? "locked"} />
              <Fact label="Head sequence" value={`#${resolution?.head?.record.payload.sequence ?? "—"}`} />
              <Fact label="Authorization" value={resolution?.reasonCode ?? "not checked"} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={verifyMerchant} disabled={!state || busy || phase !== "unverified"}>
                {busy ? <Spinner /> : null} Verify merchant
              </Button>
              <Button
                variant="secondary"
                onClick={rotateMerchant}
                disabled={!state || busy || phase !== "verified"}
              >
                Rotate wallet
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy || phase === "unverified"}>
                Reset
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Verifier result</SectionLabel>
              {resolution ? <StatusBadge status={resolution.status} /> : null}
            </div>
            {checks.length === 0 ? (
              <p className="mt-3 text-[12px] text-ivory-muted">
                Verify the merchant to unlock the payment destination.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-[11.5px]">
                    <span className={check.ok ? "text-accent-bright" : "text-danger"}>
                      {check.ok ? "✓" : "✕"}
                    </span>
                    <span className={check.ok ? "text-ivory-dim" : "text-ivory"}>{check.label}</span>
                    <span className="ml-auto max-w-[48%] break-all text-right font-mono text-[9px] text-ivory-muted">
                      {check.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={cn("p-5", destination ? "border-accent/30" : "border-ivory/[0.1]")}>
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Payment destination</SectionLabel>
              <Badge tone={destination ? "accent" : "neutral"}>
                {destination ? "verified" : "locked"}
              </Badge>
            </div>
            {destination ? (
              <div className="mt-3">
                <div className="break-all font-mono text-[12px] text-ivory">{destination}</div>
                <div className="mt-2 flex items-center gap-2">
                  <CopyButton value={destination} label="Copy address" />
                  {phase === "rotated" ? <Badge tone="warn">wallet B</Badge> : <Badge tone="neutral">wallet A</Badge>}
                </div>
                {phase === "rotated" && resolution ? (
                  <p className="mt-3 break-all font-mono text-[9.5px] leading-relaxed text-ivory-muted">
                    old wallet A · {shortAddress(state?.fixtures.walletA.identity.address)} · superseded
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[11.5px] leading-relaxed text-ivory-muted">
                Locked until the merchant identity verifies.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <SectionLabel>Safety</SectionLabel>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ivory-dim">
              <li>◆ Only an ACTIVE chain can unlock a destination.</li>
              <li>◆ Rotation changes the destination after verification.</li>
              <li>◆ The old wallet is reported superseded.</li>
              <li>◆ No payment was broadcast in this demo.</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/challenge"
                className="font-mono text-[9px] uppercase tracking-[0.1em] text-signal hover:text-signal-bright"
              >
                Trust Challenge →
              </Link>
              <Link
                href="/pay"
                className="font-mono text-[9px] uppercase tracking-[0.1em] text-ivory-muted hover:text-ivory"
              >
                KYVERA Pay
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-ivory/[0.06] pb-1.5 last:border-0">
      <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-ivory-muted">{label}</div>
      <div className="mt-0.5 break-all font-mono text-[9.5px] text-ivory-dim">{value || "—"}</div>
    </div>
  );
}
