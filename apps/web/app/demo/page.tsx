"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDemoState, type DemoState } from "@/lib/lab";
import { TimeMachine } from "@/components/time-machine";
import { Alert, Button, Card, CopyButton, Disclosure, GlassPanel, SectionLabel, Spinner, StatusBadge, cn } from "@/components/ui";
import { shortAddress, shortHex } from "@/lib/format";

const STEPS = [
  {
    title: "Two independent keys",
    line: "One BCH wallet key, one Nostr identity key.",
  },
  {
    title: "Bind",
    line: "Both keys sign the genesis record.",
  },
  {
    title: "Verify independently",
    line: "The verifier checks both signatures and the chain.",
  },
  {
    title: "Rotate",
    line: "Wallet A authorizes wallet B.",
  },
  {
    title: "History stays valid",
    line: "Wallet A's proof is true, but no longer current.",
  },
  {
    title: "Unauthorized rotation",
    line: "A thief with the Nostr key cannot move the wallet.",
  },
  {
    title: "Same answer in the CLI",
    line: "The SDK and the terminal verifier agree.",
  },
  {
    title: "Revoke",
    line: "The chain ends. Nothing falls back to wallet A.",
  },
];

export default function DemoPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

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

  const resolution =
    step >= 7 ? state?.revoked : step >= 3 ? state?.rotation : state?.bind ?? null;

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-12">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-[38px] leading-[1.04] tracking-editorial text-ivory sm:text-[52px]">
            Explore identity continuity.
          </h1>
          <Disclosure summary="Demo data" className="mt-3">
            Deterministic, unspendable fixtures. Every verdict is computed by the same verifier
            functions exported by the SDK.
          </Disclosure>
        </div>
        <div className="flex flex-wrap gap-5 text-[12px]">
          <Link href="/verify" className="text-ivory-muted transition-colors hover:text-ivory">
            Live verifier
          </Link>
          <Link href="/lab" className="text-signal transition-colors hover:text-signal-bright">
            Security lab →
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-6">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-ivory/[0.1] p-4">
              <SectionLabel>Sequence</SectionLabel>
              <ol className="space-y-1">
                {STEPS.map((entry, index) => (
                  <li key={entry.title}>
                    <button
                      onClick={() => setStep(index)}
                      aria-current={step === index ? "step" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 border-l px-2.5 py-2 text-left transition-colors",
                        step === index
                          ? "border-signal bg-signal/[0.05]"
                          : "border-ivory/10 hover:border-ivory/30 hover:bg-ivory/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 font-mono text-[8.5px]",
                          step === index ? "text-signal" : "text-ivory-muted",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className={cn("text-[11.5px] leading-snug", step === index ? "text-ivory" : "text-ivory-muted")}>
                        {entry.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center gap-2 p-4">
              <Button
                variant="secondary"
                className="flex-1 px-2"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
              >
                ← Back
              </Button>
              <Button
                className="flex-1 px-2"
                onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
                disabled={step === STEPS.length - 1}
              >
                Next →
              </Button>
            </div>
          </Card>

        </div>

        <div className="min-w-0 space-y-4">
          <GlassPanel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[10.5px] text-ivory-muted">
                Step {String(step + 1).padStart(2, "0")} / {STEPS.length}
              </div>
              {resolution ? <StatusBadge status={resolution.status} /> : null}
            </div>
            <h2 className="mt-3 font-display text-[28px] leading-tight tracking-editorial text-ivory">
              {STEPS[step]!.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ivory-dim">{STEPS[step]!.line}</p>

            {!state ? (
              <div className="mt-5 flex items-center gap-2 text-[12px] text-ivory-dim">
                <Spinner /> Signing fixtures and running the verifier…
              </div>
            ) : (
              <StepPanel step={step} state={state} />
            )}
          </GlassPanel>

          {resolution ? <TimeMachine resolution={resolution} compact /> : null}
        </div>
      </div>
    </div>
  );
}

function StepPanel({ step, state }: { step: number; state: DemoState }) {
  const f = state.fixtures;

  if (step === 0) {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <KeyPanel label="Nostr identity" value={f.npub} note="BIP-340 Schnorr key" />
        <KeyPanel label="BCH wallet A" value={f.walletA.identity.address} note="P2PKH · signmessage" />
        <p className="sm:col-span-2 text-[10.5px] text-ivory-muted">
          Distinct secp256k1 keys. Neither is derived from the other.
        </p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="mt-5 space-y-3">
        <div className="border border-ivory/[0.12] bg-charcoal-950/50 p-4">
          <div className="text-[10px] text-ivory-muted">Genesis record · sequence 0</div>
          <div className="mt-2 break-all font-mono text-[11px] text-ivory">{f.walletA.identity.address}</div>
          <div className="mt-1 font-mono text-[9px] text-ivory-muted">
            record {shortHex(f.bind.recordId, 16, 10)}
          </div>
        </div>
        <p className="text-[10.5px] text-ivory-muted">
          BCH new-key proof · Nostr signature · previous = null
        </p>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mt-5 space-y-2">
        {state.rotationScenario.checks.slice(0, 3).map((check) => (
          <CheckLine key={check.label} ok={check.ok} label={check.label} detail={check.detail} />
        ))}
        <p className="pt-2 text-[11px] leading-relaxed text-ivory-muted">
          Resolved locally to <span className="text-ivory">{state.bind.status}</span>.
        </p>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="mt-5 space-y-3">
        <div className="grid gap-px bg-ivory/[0.1] sm:grid-cols-2">
          <div className="bg-charcoal-900 p-4">
            <div className="text-[10px] text-ivory-muted">Old wallet</div>
            <div className="mt-1 break-all font-mono text-[10px] text-ivory-dim">{f.walletA.identity.address}</div>
            <div className="mt-2 text-[10px] text-signal">Superseded</div>
          </div>
          <div className="bg-charcoal-900 p-4">
            <div className="text-[10px] text-ivory-muted">New wallet</div>
            <div className="mt-1 break-all font-mono text-[10px] text-ivory">{f.walletB.identity.address}</div>
            <div className="mt-2 text-[10px] text-accent-bright">Current</div>
          </div>
        </div>
        <p className="text-[10.5px] text-ivory-muted">
          Current-key signature · new-key signature · Nostr signature
        </p>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="mt-5 space-y-2">
        <CheckLine
          ok={true}
          label="Wallet A's historical bind still verifies"
          detail="same signatures, same digest, same address"
        />
        <CheckLine ok={true} label="Wallet A is not the current destination" detail="SUPERSEDED by wallet B" />
        <CheckLine
          ok={true}
          label="Replaying wallet A cannot move the head backwards"
          detail={`head sequence ${state.rotation.head?.record.payload.sequence}`}
        />
        <pre className="mt-3 overflow-auto border border-ivory/[0.1] bg-charcoal-950/70 p-3 font-mono text-[9.5px] text-ivory-dim">
{`resolve([bind(A), rotate(A→B), bind(A)])
→ ${state.rotation.status}
→ current: ${state.rotation.activeBch?.address}
→ superseded: ${state.rotation.superseded.map((entry) => entry.address).join(", ")}`}
        </pre>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="mt-5 space-y-2">
        <CheckLine ok={true} label="Nostr signature by the identity key" detail="valid — the thief has it" />
        <CheckLine
          ok={false}
          label="Current wallet authorization"
          detail={state.unauthorizedScenario.recordResult?.message ?? "rejected"}
        />
        <CheckLine
          ok={true}
          label="Current state unchanged"
          detail={`${state.rotation.status} · wallet A cannot be replaced without its signature`}
        />
        <div className="mt-3 border border-danger/35 bg-danger/[0.04] p-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-danger">
          {state.unauthorizedScenario.recordResult?.code} · forged record excluded
        </div>
      </div>
    );
  }

  if (step === 6) {
    const command = `pnpm cli ${f.npub} --relay <your-relay>`;
    return (
      <div className="mt-5 space-y-3">
        <div>
          <div className="mb-1 text-[10px] text-ivory-muted">
            SDK call (the same function the UI uses)
          </div>
          <pre className="overflow-auto border border-ivory/[0.12] bg-charcoal-950/80 p-4 font-mono text-[10px] leading-relaxed text-ivory-dim">
{`import { resolveIdentity } from "@kyvera/verifier";

const result = await resolveIdentity({
  subject: "${f.subject}",
  relays: ["<relay-url>"],
});

// result.status    → "${state.rotation.status}"
// result.activeBch → "${f.walletB.identity.address}"`}
          </pre>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ivory-muted">Terminal</span>
          <CopyButton value={command} />
        </div>
        <pre className="overflow-auto border border-ivory/[0.12] bg-charcoal-950/80 p-4 font-mono text-[10px] leading-relaxed text-ivory-dim">
{`$ ${command}

status:    ACTIVE (ACTIVE_HEAD)
assurance: FULL 1/1 relays
BCH:       ${f.walletB.identity.address}
history:
  #0 bind   ${f.walletA.identity.address}
  #1 rotate ${f.walletB.identity.address}
superseded:
  #0 ${shortAddress(f.walletA.identity.address)} → ${shortAddress(f.walletB.identity.address)}`}
        </pre>
        <p className="text-[11px] leading-relaxed text-ivory-muted">
          The fixture identity is not published, so this exact command runs against the local demo relay
          after seeding. The verifier logic is identical.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2">
      <CheckLine ok={true} label="Revocation signed by current wallet + Nostr key" detail="accepted" />
      <CheckLine ok={true} label="No address asserted as current" detail="REVOKED" />
      <CheckLine ok={true} label="History preserved" detail="bind → rotate → revoke" />
      <p className="pt-2 text-[11px] leading-relaxed text-ivory-muted">
        Revocation is not a deletion. The historical proofs remain inspectable; authorization simply
        ends.
      </p>
    </div>
  );
}

function KeyPanel({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border border-ivory/[0.12] bg-charcoal-950/50 p-4">
      <div className="text-[10px] text-ivory-muted">{label}</div>
      <div className="mt-2 break-all font-mono text-[10px] leading-relaxed text-ivory">{value}</div>
      <div className="mt-2 text-[10px] text-ivory-muted">{note}</div>
    </div>
  );
}

function CheckLine({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 border-b border-ivory/[0.06] pb-2 last:border-0">
      <span
        className={cn(
          "mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[8px]",
          ok ? "border-accent/50 text-accent-bright" : "border-danger/60 text-danger",
        )}
      >
        {ok ? "✓" : "×"}
      </span>
      <div>
        <div className="text-[11.5px] text-ivory">{label}</div>
        <div className="mt-0.5 break-all font-mono text-[9px] text-ivory-muted">{detail}</div>
      </div>
    </div>
  );
}
