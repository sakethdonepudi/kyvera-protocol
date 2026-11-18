"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { runLifecyclePreview, type PreviewState } from "@/lib/lab";
import { Badge, Spinner, StatusBadge, cn } from "./ui";
import { shortAddress } from "@/lib/format";

const STEPS = ["bind", "rotate", "revoke"] as const;

export function LifecycleDemo() {
  const [states, setStates] = useState<PreviewState[] | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    runLifecyclePreview()
      .then((result) => {
        if (!cancelled) {
          setStates(result);
          setElapsed(Math.round(performance.now() - start));
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const state = states?.[index];

  return (
    <div className="border border-ivory/[0.14] bg-charcoal-900/60">
      <div className="flex items-center justify-between border-b border-ivory/[0.1] px-4 py-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ivory-muted">
          Live resolver · deterministic fixture
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-accent-bright">
            real verifier
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-ivory/[0.1]">
        {STEPS.map((step, stepIndex) => (
          <button
            key={step}
            onClick={() => setIndex(stepIndex)}
            aria-pressed={index === stepIndex}
            className={cn(
              "border-r border-ivory/[0.08] px-3 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] transition-colors last:border-r-0",
              index === stepIndex
                ? "bg-ivory text-charcoal-950"
                : "text-ivory-muted hover:bg-ivory/[0.04] hover:text-ivory",
            )}
          >
            0{stepIndex + 1} {step}
          </button>
        ))}
      </div>

      <div className="p-5">
        {error ? (
          <p className="text-[12px] text-danger">{error}</p>
        ) : !state ? (
          <div className="flex items-center gap-2 py-8 text-[12px] text-ivory-dim">
            <Spinner /> Signing deterministic records and resolving…
          </div>
        ) : (
          <div className="animate-fade">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={state.status} />
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ivory-muted">
                {state.history} valid record{state.history === 1 ? "" : "s"}
                {elapsed !== null ? ` · ${elapsed}ms` : ""}
              </span>
            </div>

            <div className="mt-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                {state.status === "REVOKED" ? "payment destination" : "currently authorized"}
              </div>
              <div className="mt-1.5 break-all font-mono text-[13px] leading-relaxed text-ivory">
                {state.address ?? "— no address asserted —"}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px bg-ivory/[0.1]">
              <div className="bg-charcoal-900 p-3">
                <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ivory-muted">
                  superseded
                </div>
                <div className="mt-1 font-mono text-[10px] text-ivory-dim">
                  {state.superseded.length === 0
                    ? "none"
                    : state.superseded.map((entry) => shortAddress(entry)).join(" · ")}
                </div>
              </div>
              <div className="bg-charcoal-900 p-3">
                <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ivory-muted">
                  verifier decision
                </div>
                <div className="mt-1 font-mono text-[10px] text-ivory-dim">{state.reason}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">unspendable test keys</Badge>
              <Badge tone={state.status === "ACTIVE" ? "accent" : state.status === "REVOKED" ? "neutral" : "warn"}>
                {state.status}
              </Badge>
              <Link
                href="/lab"
                className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-signal hover:text-signal-bright"
              >
                Inspect the proofs →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-ivory/[0.1] px-4 py-2.5 font-mono text-[8.5px] uppercase leading-relaxed tracking-[0.1em] text-ivory-muted">
        Actual resolveEvents() output in this browser. Fixture keys are derived from labels and must never
        be funded.
      </div>
    </div>
  );
}
