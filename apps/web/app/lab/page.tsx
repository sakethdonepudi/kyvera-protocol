"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LAB_NOW, runLab, type LabReport, type LabScenario, type LabVerdict } from "@/lib/lab";
import { Badge, Button, Card, SectionLabel, Spinner, cn } from "@/components/ui";
import { timestamp } from "@/lib/format";

const VERDICT_LABEL: Record<LabVerdict, string> = {
  accepted: "Accepted",
  rejected: "Rejected",
  conflict: "Conflict",
  stale: "Stale",
  revoked: "Revoked",
};

function verdictClass(verdict: LabVerdict): string {
  if (verdict === "accepted") return "border-accent/50 bg-accent/[0.07] text-accent-bright";
  if (verdict === "revoked") return "border-ivory/25 bg-ivory/[0.03] text-ivory-dim";
  if (verdict === "stale") return "border-signal/45 bg-signal/[0.05] text-signal-bright";
  return "border-danger/45 bg-danger/[0.05] text-danger";
}

export default function LabPage() {
  const [report, setReport] = useState<LabReport | null>(null);
  const [selectedId, setSelectedId] = useState("rotation");
  const [advanced, setAdvanced] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function execute() {
    setRunning(true);
    setError("");
    try {
      setReport(await runLab());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void execute();
  }, []);

  const selected = useMemo(
    () => report?.scenarios.find((scenario) => scenario.id === selectedId) ?? report?.scenarios[0],
    [report, selectedId],
  );

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-12">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <div className="kicker text-signal">Security laboratory</div>
          <h1 className="mt-3 font-display text-[36px] leading-[1.08] tracking-editorial text-ivory sm:text-[46px]">
            Six executable claims.
            <br />
            No mock verdicts.
          </h1>
          <p className="mt-4 text-[13px] leading-relaxed text-ivory-dim">
            Each scenario builds real signed records with unspendable deterministic keys, then runs the
            same verifier functions the CLI and public verifier use. Nothing here is a precomputed badge.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-ivory/15 p-0.5" role="group" aria-label="Detail level">
            {[false, true].map((value) => (
              <button
                key={String(value)}
                onClick={() => setAdvanced(value)}
                aria-pressed={advanced === value}
                className={cn(
                  "rounded-[1px] px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em]",
                  advanced === value ? "bg-ivory text-charcoal-950" : "text-ivory-muted hover:text-ivory",
                )}
              >
                {value ? "Advanced" : "Simple"}
              </button>
            ))}
          </div>
          <Button onClick={() => void execute()} disabled={running}>
            {running ? <Spinner /> : null} Re-run all
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-ivory/[0.08] py-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ivory-muted">
        <span>deterministic fixtures · unspendable keys</span>
        <span className="text-ivory/20">/</span>
        <span>evaluated at {timestamp(LAB_NOW)}</span>
        <span className="text-ivory/20">/</span>
        <span>local verification · no relay, no network</span>
        {report ? (
          <span className="ml-auto text-accent-bright">{report.scenarios.length} scenarios executed</span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-5 border border-danger/40 bg-danger/[0.05] p-4 text-[12px] text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[330px_1fr]">
        <div className="space-y-2">
          {(report?.scenarios ?? []).map((scenario, index) => (
            <button
              key={scenario.id}
              onClick={() => setSelectedId(scenario.id)}
              aria-pressed={selected?.id === scenario.id}
              className={cn(
                "w-full border px-4 py-3.5 text-left transition-colors",
                selected?.id === scenario.id
                  ? "border-signal/60 bg-signal/[0.04]"
                  : "border-ivory/[0.12] bg-charcoal-900/40 hover:border-ivory/30",
              )}
            >
              <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                <span>0{index + 1}</span>
                <span className={cn("border px-1.5 py-0.5", verdictClass(scenario.verdict))}>
                  {VERDICT_LABEL[scenario.verdict]}
                </span>
              </div>
              <div className="mt-2 text-[13px] font-medium text-ivory">{scenario.title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-ivory-muted">{scenario.question}</div>
            </button>
          ))}
          {!report && running ? (
            <Card className="flex items-center gap-3 p-6 text-[12px] text-ivory-dim">
              <Spinner /> Signing fixtures and running the verifier…
            </Card>
          ) : null}

          <Card className="mt-3 p-4">
            <SectionLabel>Test references</SectionLabel>
            <ul className="space-y-1.5 font-mono text-[9px] leading-relaxed text-ivory-muted">
              <li>tests/binding.test.ts</li>
              <li>tests/rotation.test.ts</li>
              <li>tests/revocation.test.ts</li>
              <li>tests/chain.test.ts</li>
              <li>tests/relay.test.ts</li>
              <li>tests/auth.test.ts</li>
            </ul>
            <p className="mt-3 text-[10px] leading-relaxed text-ivory-muted">
              Run locally with <code className="text-ivory-dim">pnpm test</code>. The same functions are
              exported from <code className="text-ivory-dim">@kyvera/verifier</code>.
            </p>
          </Card>
        </div>

        <div className="min-w-0">{selected ? <ScenarioDetail scenario={selected} advanced={advanced} onReplay={() => void execute()} /> : null}</div>
      </div>
    </div>
  );
}

function ScenarioDetail({ scenario, advanced, onReplay }: { scenario: LabScenario; advanced: boolean; onReplay: () => void }) {
  return (
    <div className="min-w-0 space-y-4 animate-fade">
      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-ivory/[0.1] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ivory-muted">
              Scenario · {scenario.id}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em]", verdictClass(scenario.verdict))}>
                {VERDICT_LABEL[scenario.verdict]} · {scenario.status}
              </span>
              <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={onReplay}>
                Replay
              </Button>
            </div>
          </div>
          <h2 className="mt-3 font-display text-[25px] leading-tight tracking-editorial text-ivory">
            {scenario.title}
          </h2>
          <p className="mt-2 text-[12.5px] text-ivory-dim">{scenario.question}</p>
          <div className="mt-4 border-l-2 border-signal/70 pl-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ivory">{scenario.headline}</div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {(scenario.resolution?.history ?? []).map((step, index) => (
              <div key={step.recordId} className="flex items-center gap-1.5">
                {index > 0 ? <span className="h-px w-3 bg-ivory/20" /> : null}
                <span className="border border-ivory/15 px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-ivory-dim">
                  #{step.record.payload.sequence} {step.record.payload.type}
                </span>
              </div>
            ))}
            {scenario.resolution?.conflict ? (
              <>
                <span className="h-px w-3 bg-danger/50" />
                <span className="border border-danger/45 px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-danger">
                  conflict · seq {scenario.resolution.conflict.sequence}
                </span>
              </>
            ) : null}
            {scenario.status === "STALE" ? (
              <>
                <span className="h-px w-3 bg-signal/50" />
                <span className="border border-signal/45 px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-signal-bright">
                  stale · no fallback
                </span>
              </>
            ) : null}
            {scenario.status === "REVOKED" ? (
              <>
                <span className="h-px w-3 bg-ivory/20" />
                <span className="border border-ivory/20 px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-ivory-muted">
                  terminal
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="p-5">
          <SectionLabel>Explanation</SectionLabel>
          <p className="text-[12.5px] leading-relaxed text-ivory-dim">{scenario.explanation}</p>

          <div className="mt-5">
            <SectionLabel>Verification evidence</SectionLabel>
            <ul className="space-y-2">
              {scenario.checks.map((check) => (
                <li key={check.label} className="grid gap-0.5 border-b border-ivory/[0.06] pb-2 last:border-0">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[8px]",
                        check.ok
                          ? "border-accent/50 text-accent-bright"
                          : "border-danger/60 text-danger",
                      )}
                    >
                      {check.ok ? "✓" : "×"}
                    </span>
                    <span className="text-[11.5px] leading-snug text-ivory">{check.label}</span>
                  </div>
                  <div className="ml-5 break-all font-mono text-[9px] leading-relaxed text-ivory-muted">
                    {check.detail}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ivory/[0.08] pt-4">
            <Badge tone="neutral">{scenario.events.length} signed events</Badge>
            <Badge tone="neutral">{scenario.recordResult ? "record check" : "chain resolution"}</Badge>
            <span className="ml-auto font-mono text-[9px] text-ivory-muted">{scenario.testRef}</span>
          </div>
        </div>
      </Card>

      {advanced ? (
        <>
          <Card className="min-w-0 overflow-hidden p-5">
            <SectionLabel>Verifier result (actual return value)</SectionLabel>
            <pre className="scroll-pane max-h-[380px] overflow-auto border border-ivory/[0.1] bg-charcoal-950/70 p-4 font-mono text-[9.5px] leading-relaxed text-ivory-dim">
{JSON.stringify(scenario.resolution ?? scenario.recordResult, null, 2)}
            </pre>
          </Card>

          <details className="min-w-0 overflow-hidden border border-ivory/[0.1] bg-charcoal-900/40">
            <summary className="cursor-pointer px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ivory-muted">
              Input events ({scenario.events.length}) — real signed fixtures
            </summary>
            <pre className="scroll-pane max-h-[420px] overflow-auto border-t border-ivory/[0.08] p-4 font-mono text-[9px] leading-relaxed text-ivory-dim">
{JSON.stringify(scenario.events, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-ivory/[0.1] px-4 py-3">
          <p className="text-[11px] leading-relaxed text-ivory-muted">
            Toggle <span className="text-ivory">Advanced</span> to inspect the raw signed events and the
            exact verifier return value.
          </p>
          <Link href="/verify" className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-signal hover:text-signal-bright">
            Try a live identity →
          </Link>
        </div>
      )}
    </div>
  );
}
