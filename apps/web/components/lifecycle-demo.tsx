"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { runLifecyclePreview, type PreviewState } from "@/lib/lab";
import { CopyButton, Disclosure, Spinner, StatusBadge, cn } from "./ui";
import { shortAddress } from "@/lib/format";

const LABELS = ["Bind", "Rotate", "Revoke"] as const;
const WALLETS = ["Wallet A", "Wallet B", null] as const;

type Role = "current" | "superseded" | "historical" | "revoked" | "other";

function roleFor(states: PreviewState[], index: number): Role {
  const final = states[states.length - 1];
  const state = states[index];
  if (!final || !state) return "other";
  if (index === states.length - 1 && final.status === "REVOKED") return "revoked";
  if (final.status === "ACTIVE" && state.address && state.address === final.address) return "current";
  if (state.address && final.superseded.includes(state.address)) {
    return index === 0 ? "historical" : "superseded";
  }
  if (index < states.length - 1) return "historical";
  return "other";
}

const ROLE_LABEL: Record<Role, string> = {
  current: "Current authorization",
  superseded: "Superseded",
  historical: "Historical",
  revoked: "Revoked",
  other: "Resolved state",
};

export function LifecycleDemo() {
  const [states, setStates] = useState<PreviewState[] | null>(null);
  const [index, setIndex] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    runLifecyclePreview()
      .then((result) => {
        if (!cancelled) setStates(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const state = states?.[index];
  const final = states?.[states.length - 1];

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <div className="text-[12px] font-medium text-ivory">Identity lifecycle</div>
        <div className="flex items-center gap-2 text-[10px] text-ivory-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", error ? "bg-danger" : "bg-accent")} />
          {error ? "Verifier error" : "Live verifier"}
        </div>
      </div>

      {error ? (
        <div className="px-4 pb-4 pt-3 text-[12px] text-danger sm:px-5">{error}</div>
      ) : !states ? (
        <div className="flex items-center gap-2 px-4 py-10 text-[12px] text-ivory-dim sm:px-5">
          <Spinner /> Resolving the chain…
        </div>
      ) : (
        <>
          <ol
            className="relative grid gap-1 px-3 pb-2 pt-3 sm:grid-cols-3 sm:gap-0 sm:px-4 sm:pt-4"
            aria-label="Identity lifecycle stages"
          >
            <span
              aria-hidden="true"
              className="absolute bottom-8 left-[23px] top-8 w-px bg-ivory/[0.12] sm:hidden"
            />
            <span
              aria-hidden="true"
              className="stage-rule absolute left-[16%] right-[16%] top-[40px] hidden h-px sm:block"
            />
            {states.map((entry, stageIndex) => {
              const role = roleFor(states, stageIndex);
              const selected = index === stageIndex;
              return (
                <li key={entry.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setIndex(stageIndex)}
                    aria-pressed={selected}
                    className={cn(
                      "group relative z-10 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-[background-color,border-color] duration-200 sm:block",
                      selected
                        ? "border-ivory/[0.14] bg-ivory/[0.055]"
                        : "border-transparent hover:bg-ivory/[0.03]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-charcoal-950 font-mono text-[8.5px] sm:mb-3",
                        role === "revoked"
                          ? "border-danger/45 text-danger"
                          : role === "current"
                            ? "border-accent/50 text-accent-bright"
                            : "border-ivory/20 text-ivory-muted",
                        selected && "ring-1 ring-ivory/[0.16]",
                      )}
                    >
                      {String(stageIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[13px]",
                            selected ? "text-ivory" : "text-ivory-dim",
                          )}
                        >
                          {LABELS[stageIndex]}
                        </span>
                        <span
                          className={cn(
                            "text-[9.5px]",
                            role === "revoked"
                              ? "text-danger"
                              : role === "current"
                                ? "text-accent-bright"
                                : "text-ivory-muted",
                          )}
                        >
                          {ROLE_LABEL[role]}
                        </span>
                      </span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-ivory-muted">
                        {entry.address ? shortAddress(entry.address) : "No address asserted"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {state ? (
            <div className="border-t border-ivory/[0.08] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-ivory">
                      Sequence #{index} · {LABELS[index]}
                    </span>
                    <span className="text-[10px] text-ivory-muted">state at this step</span>
                    <StatusBadge status={state.status} />
                  </div>
                  <div className="mt-2 text-[10.5px] text-ivory-muted">{state.reason}</div>
                </div>
                <span className="text-[10px] text-ivory-muted">
                  {state.history} valid record{state.history === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-ivory/[0.07] bg-charcoal-950/35 px-3 py-2.5">
                <div className="text-[10px] text-ivory-muted">
                  {WALLETS[index] ?? "Destination"}
                </div>
                <div className="mt-0.5 truncate font-mono text-[12px] text-ivory">
                  {state.address ? shortAddress(state.address) : "No currently authorized destination"}
                </div>
                {state.address ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <CopyButton value={state.address} label="Copy" />
                    <Disclosure summary="Full address" className="text-[10px]">
                      <span className="break-all font-mono text-[10px] text-ivory-dim">
                        {state.address}
                      </span>
                    </Disclosure>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10.5px] text-ivory-muted">
                  {state.superseded.length > 0 ? (
                    <>
                      Superseded:{" "}
                      <span className="font-mono text-ivory-dim">
                        {state.superseded.map((entry) => shortAddress(entry)).join(" · ")}
                      </span>
                    </>
                  ) : (
                    "No prior wallet in this chain."
                  )}
                </div>
                <Link
                  href="/lab"
                  className="text-[11px] text-signal transition-colors hover:text-signal-bright"
                >
                  Inspect proofs →
                </Link>
              </div>
            </div>
          ) : null}

          {final?.status === "REVOKED" ? (
            <div className="border-t border-ivory/[0.08] px-4 py-3 text-[10.5px] text-ivory-muted sm:px-5">
              The chain ends in revocation. No address is currently authorized.
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ivory/[0.08] px-4 py-2.5 sm:px-5">
        <span className="text-[9.5px] text-ivory-muted">Deterministic fixtures</span>
        <Disclosure summary="Demo details" className="text-[10px]">
          Actual <span className="font-mono">resolveEvents()</span> output in this browser. Fixture keys
          are derived from labels and must never be funded.
        </Disclosure>
      </div>
    </div>
  );
}
