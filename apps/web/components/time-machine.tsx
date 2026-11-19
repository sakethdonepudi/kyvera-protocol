"use client";

import { useMemo, useState } from "react";
import {
  buildBchProofMessage,
  type ChainStep,
  type IdentityStatus,
} from "@kyvera/core";
import type { IdentityResolution } from "@kyvera/verifier";
import { Badge, Card, CopyButton, GlassPanel, SectionLabel, StatusBadge, cn } from "./ui";
import { STATUS_LABEL, shortHex, timestamp } from "@/lib/format";

type Mode = "plain" | "compare" | "crypto";

function stepStatus(resolution: IdentityResolution, index: number): IdentityStatus {
  if (index < resolution.history.length - 1) return "SUPERSEDED";
  return resolution.status;
}

function typeLabel(type: ChainStep["record"]["payload"]["type"]): string {
  if (type === "bind") return "GENESIS BIND";
  if (type === "rotate") return "AUTHORIZED ROTATE";
  return "REVOCATION";
}

function changeSummary(step: ChainStep, previous: ChainStep | undefined): string {
  const payload = step.record.payload;
  if (payload.type === "bind") {
    return `Establishes the identity at sequence 0 and authorizes ${payload.bch?.address ?? "no address"}.`;
  }
  if (payload.type === "rotate") {
    return `Moves the payment identity from ${previous?.record.payload.bch?.address ?? "the previous address"} to ${payload.bch?.address ?? "no address"}. The old wallet signed this transition.`;
  }
  return `Ends the chain. ${previous?.record.payload.bch?.address ?? "The previous address"} remains a valid historical proof but is no longer a current destination.`;
}

export function TimeMachine({
  resolution,
  compact = false,
}: {
  resolution: IdentityResolution;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("plain");

  const history = resolution.history;
  const headIndex = history.length - 1;
  const activeIndex =
    headIndex < 0 ? null : selected === null ? headIndex : Math.min(selected, headIndex);
  const step = activeIndex !== null ? history[activeIndex] : undefined;

  const detail = useMemo(() => {
    if (!step) return null;
    const proof = step.record.proofs.bch;
    const event = step.event;
    const sources = step.eventId ? resolution.sources[step.eventId] : undefined;
    return {
      proof,
      event,
      sources: sources ?? [],
      bchMessages: proof.map((entry) => ({
        role: entry.role,
        address: entry.address,
        message: buildBchProofMessage(entry.role, entry.address, step.payloadDigest),
        signature: entry.signature,
      })),
      previousAddress:
        activeIndex !== null && activeIndex > 0
          ? history[activeIndex - 1]?.record.payload.bch?.address ?? null
          : null,
    };
  }, [step, resolution.sources, history, activeIndex]);

  if (history.length === 0) {
    return (
      <Card className="p-6">
        <SectionLabel>Identity time machine</SectionLabel>
        <p className="text-[12.5px] leading-relaxed text-ivory-dim">
          No valid authorization chain was established, so there is no history to inspect. This is a
          meaningful result, not an empty UI: {resolution.reason}
        </p>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory/[0.1] px-5 py-4">
          <div>
            <SectionLabel>Identity time machine</SectionLabel>
            <p className="text-[12px] text-ivory-muted">
              Every node below is a verified record. Select one to inspect its proofs, ordering and relay
              observations.
            </p>
          </div>
          <div className="flex rounded-[2px] border border-ivory/15 p-0.5" role="group" aria-label="Detail mode">
            {(["plain", "compare", "crypto"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  "rounded-[1px] px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-colors",
                  mode === value ? "bg-ivory text-charcoal-950" : "text-ivory-muted hover:text-ivory",
                )}
              >
                {value === "plain" ? "Plain" : value === "compare" ? "Compare" : "Cryptographic"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 pt-6">
          <div className="scroll-pane -mx-1 overflow-x-auto pb-2">
            <ol className="flex min-w-max items-stretch gap-0">
              {history.map((entry, index) => {
                const status = stepStatus(resolution, index);
                const isActive = activeIndex === index;
                const isHead = index === headIndex;
                return (
                  <li key={entry.recordId} className="relative flex">
                    {index > 0 ? (
                      <div className="mt-[38px] h-px w-8 shrink-0 bg-ivory/20 sm:w-12" aria-hidden="true" />
                    ) : null}
                    <button
                      onClick={() => setSelected(index)}
                      aria-pressed={isActive}
                      className={cn(
                        "group relative w-[180px] shrink-0 border px-3.5 py-3 text-left transition-colors sm:w-[210px]",
                        isActive
                          ? "border-signal/70 bg-signal/[0.05]"
                          : "border-ivory/15 bg-charcoal-950/40 hover:border-ivory/35",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-x-0 top-0 h-[2px]",
                          isHead ? "bg-signal" : "bg-ivory/20",
                        )}
                      />
                      <span className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                        <span>#{entry.record.payload.sequence}</span>
                        <span>{isHead ? "head" : "history"}</span>
                      </span>
                      <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-ivory">
                        {typeLabel(entry.record.payload.type)}
                      </span>
                      <span className="mt-2 block truncate font-mono text-[10px] text-ivory-dim">
                        {entry.record.payload.bch?.address ?? "no payment address"}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] text-ivory-muted">
                        {timestamp(entry.record.payload.issuedAt)}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em]">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            status === "ACTIVE"
                              ? "bg-accent"
                              : status === "SUPERSEDED"
                                ? "bg-signal"
                                : "bg-danger",
                          )}
                        />
                        <span className={status === "ACTIVE" ? "text-accent-bright" : "text-ivory-muted"}>
                          {status === "ACTIVE" ? "authorized now" : STATUS_LABEL[status]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {resolution.conflict ? (
                <li className="relative flex">
                  <div className="mt-[38px] h-px w-8 shrink-0 border-t border-dashed border-danger/60 sm:w-12" />
                  <div className="w-[180px] shrink-0 border border-danger/50 bg-danger/[0.05] px-3.5 py-3 sm:w-[210px]">
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-danger">
                      conflict
                    </div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ivory">
                      EQUIVOCATION
                    </div>
                    <div className="mt-2 font-mono text-[9px] text-ivory-muted">
                      seq #{resolution.conflict.sequence} · {resolution.conflict.recordIds.length} records
                    </div>
                  </div>
                </li>
              ) : null}
            </ol>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ivory/[0.08] pt-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ivory-muted">
            {resolution.sync.total === 0 ? (
              <Badge tone="neutral">local fixture</Badge>
            ) : (
              <Badge tone={resolution.assurance === "FULL" ? "accent" : "warn"}>
                {resolution.assurance} relay sync
              </Badge>
            )}
            <span>
              {resolution.sync.total === 0
                ? "no relay queried"
                : `${resolution.sync.responded}/${resolution.sync.total} relays`}
            </span>
            <span className="text-ivory/20">/</span>
            <span>verified {timestamp(resolution.checkedAt)}</span>
            {resolution.status === "ACTIVE" ? (
              <span className="ml-auto text-accent-bright">current destination asserted</span>
            ) : (
              <span className="ml-auto text-signal-bright">current destination withheld</span>
            )}
          </div>
        </div>
      </Card>

      {step && detail ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassPanel className="min-w-0 overflow-hidden p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ivory-muted">
                  Record #{step.record.payload.sequence} · {typeLabel(step.record.payload.type)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={stepStatus(resolution, activeIndex!)} />
                  <Badge tone="neutral">{step.record.payload.type}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">Issued</div>
                <div className="mt-1 font-mono text-[10.5px] text-ivory-dim">
                  {timestamp(step.record.payload.issuedAt)}
                </div>
              </div>
            </div>

            <p className="mt-4 text-[12.5px] leading-relaxed text-ivory-dim">
              {changeSummary(step, history[activeIndex! - 1])}
            </p>

            <div className="mt-5 space-y-2">
              <SectionLabel>Why this record is accepted</SectionLabel>
              <Check label="Nostr event signed by the identity key" detail={step.event ? `event ${shortHex(step.event.id, 10, 6)}` : "event metadata unavailable"} />
              <Check
                label={`BCH ${detail.proof.map((entry) => entry.role).join(" + ")} proof${detail.proof.length > 1 ? "s" : ""} recovered to the declared address`}
                detail={detail.proof.map((entry) => `${entry.role} · ${shortHex(entry.address, 12, 8)}`).join(" / ")}
              />
              <Check
                label={
                  step.record.payload.type === "bind"
                    ? "Genesis: sequence 0 with no predecessor"
                    : `Chain link matches record #${step.record.payload.sequence - 1}`
                }
                detail={step.record.payload.previous ? shortHex(step.record.payload.previous, 14, 10) : "genesis"}
              />
              <Check
                label={
                  step.record.payload.type === "rotate"
                    ? "Current wallet authorized leaving; new wallet proved control"
                    : step.record.payload.type === "revoke"
                      ? "Current wallet and identity key authorized revocation"
                      : "Both independent keys authorized the initial binding"
                }
                detail={detail.previousAddress ?? "no predecessor"}
              />
            </div>

            {mode === "plain" ? (
              <div className="mt-5 border-t border-ivory/[0.08] pt-4 text-[11px] leading-relaxed text-ivory-muted">
                <p>
                  Historical validity and current authorization are separate facts. This record is
                  cryptographically valid. It is{stepStatus(resolution, activeIndex!) === "ACTIVE" ? " " : " not "}
                  the current payment authorization.
                </p>
                <p className="mt-2">
                  Relay freshness describes what this verifier could reach. It is not a proof that no
                  newer record exists anywhere.
                </p>
              </div>
            ) : mode === "compare" ? (
              <CompareView
                resolution={resolution}
                step={step}
                index={activeIndex!}
                status={stepStatus(resolution, activeIndex!)}
              />
            ) : (
              <div className="mt-5 space-y-4 border-t border-ivory/[0.08] pt-4">
                <Digest label="Record digest" value={step.recordId} />
                <Digest label="Payload digest" value={step.payloadDigest} />
                <Digest label="Previous digest" value={step.record.payload.previous ?? "genesis"} />
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                      BCH proof message
                    </span>
                    <CopyButton value={detail.bchMessages[0]?.message ?? ""} />
                  </div>
                  {detail.bchMessages.map((entry) => (
                    <pre
                      key={entry.role}
                      className="scroll-pane mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all border border-ivory/[0.1] bg-charcoal-950/70 p-3 font-mono text-[10px] leading-relaxed text-ivory-dim"
                    >
{entry.message}
                    </pre>
                  ))}
                </div>
              </div>
            )}
          </GlassPanel>

          <div className="min-w-0 space-y-4">
            <Card className="min-w-0 overflow-hidden p-5">
              <SectionLabel>Authorization evidence</SectionLabel>
              <dl className="space-y-3">
                <EvidenceRow label="BCH address" value={step.record.payload.bch?.address ?? "none"} />
                {detail.proof.map((entry) => (
                  <div key={entry.role}>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                      BCH {entry.role} signature
                    </dt>
                    <dd className="mt-1 break-all font-mono text-[9.5px] leading-relaxed text-ivory-dim">
                      {entry.signature}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                    Nostr signature
                  </dt>
                  <dd className="mt-1 break-all font-mono text-[9.5px] leading-relaxed text-ivory-dim">
                    {step.event?.sig ?? "not retained"}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                    Event id
                  </dt>
                  <dd className="mt-1 break-all font-mono text-[9.5px] text-ivory-dim">
                    {step.event?.id ?? step.eventId ?? "—"}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="min-w-0 overflow-hidden p-5">
              <SectionLabel>Relay observations</SectionLabel>
              {detail.sources.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-ivory-muted">
                  Offline / deterministic fixture. No relay supplied this record in the current
                  verification run.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.sources.map((source) => (
                    <li key={source} className="flex items-center gap-2 font-mono text-[10px] text-ivory-dim">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {source}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-ivory/[0.08] pt-3">
                <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.1em] text-ivory-muted">
                  <span>relay freshness</span>
                  <span>{resolution.sync.total === 0 ? "LOCAL" : resolution.assurance}</span>
                </div>
                <div className="mt-2 h-[3px] w-full bg-ivory/10">
                  <div
                    className={cn(
                      "h-full",
                      resolution.sync.total === 0
                        ? "w-full bg-ivory/30"
                        : resolution.assurance === "FULL"
                        ? "w-full bg-accent"
                        : resolution.assurance === "PARTIAL"
                          ? "w-2/3 bg-signal"
                          : "w-1/4 bg-danger",
                    )}
                  />
                </div>
              </div>
            </Card>

            <details className="min-w-0 overflow-hidden border border-ivory/[0.1] bg-charcoal-900/40">
              <summary className="cursor-pointer px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ivory-muted">
                Raw record and event
              </summary>
              <pre className="scroll-pane max-h-72 overflow-auto border-t border-ivory/[0.08] p-4 font-mono text-[9.5px] leading-relaxed text-ivory-dim">
{JSON.stringify({ record: step.record, event: step.event }, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      ) : null}

      {!compact && resolution.conflict ? (
        <Card className="border-danger/40 p-5">
          <SectionLabel>Equivocation evidence</SectionLabel>
          <p className="text-[12px] leading-relaxed text-danger">
            Sequence {resolution.conflict.sequence} contains {resolution.conflict.recordIds.length} competing
            valid records. A verifier must not pick a winner by timestamp or relay order.
          </p>
          <ul className="mt-3 space-y-1 font-mono text-[9.5px] text-ivory-muted">
            {resolution.conflict.recordIds.map((id) => (
              <li key={id} className="break-all">
                {id}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {resolution.rejected.length > 0 ? (
        <Card className="min-w-0 overflow-hidden p-5">
          <SectionLabel>Excluded records</SectionLabel>
          <ul className="space-y-2">
            {resolution.rejected.slice(0, 8).map((entry, index) => (
              <li key={`${entry.eventId}-${index}`} className="grid gap-1 border-b border-ivory/[0.06] pb-2 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-danger">
                    {entry.code}
                  </span>
                  {entry.sequence !== undefined ? (
                    <span className="font-mono text-[9px] text-ivory-muted">
                      seq #{entry.sequence} · {entry.type}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] leading-relaxed text-ivory-dim">{entry.message}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function CompareView({
  resolution,
  step,
  index,
  status,
}: {
  resolution: IdentityResolution;
  step: ChainStep;
  index: number;
  status: IdentityStatus;
}) {
  const isHead = index === resolution.history.length - 1;
  const current = resolution.activeBch?.address ?? null;
  return (
    <div className="mt-5 border-t border-ivory/[0.08] pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-accent/30 bg-accent/[0.04] p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent-bright">
            Historical proof
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ivory">
            VALID
          </div>
          <ul className="mt-3 space-y-1.5 text-[10.5px] leading-relaxed text-ivory-dim">
            <li>◆ Nostr Schnorr signature verified</li>
            <li>◆ BCH proof recovers to the declared address</li>
            <li>◆ Payload and record digests match</li>
            <li>◆ Predecessor link matches the chain</li>
          </ul>
          <p className="mt-3 font-mono text-[9px] text-ivory-muted">
            This remains true forever, even after rotation or revocation.
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-4",
            status === "ACTIVE"
              ? "border-accent/30 bg-accent/[0.04]"
              : "border-signal/35 bg-signal/[0.04]",
          )}
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
            {status === "ACTIVE" && resolution.assurance !== "FULL"
              ? "Reported current · partial sync"
              : "Current authorization"}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {status === "ACTIVE" && resolution.assurance !== "FULL" ? (
              <Badge tone="warn">ACTIVE · not final</Badge>
            ) : (
              <StatusBadge status={status} />
            )}
          </div>
          <ul className="mt-3 space-y-1.5 text-[10.5px] leading-relaxed text-ivory-dim">
            <li>◆ This record is {isHead ? "the chain head" : "not the chain head"}</li>
            <li>◆ Current address: {current ?? "none asserted"}</li>
            <li>◆ Relay assurance: {resolution.assurance}</li>
            <li>◆ Sequence {step.record.payload.sequence} of {resolution.history.length - 1}</li>
          </ul>
          <p className="mt-3 font-mono text-[9px] text-ivory-muted">
            {status === "ACTIVE" && resolution.assurance !== "FULL"
              ? "Partial relay agreement; do not treat this as final payment authorization."
              : status === "ACTIVE"
                ? "This record currently authorizes payment."
                : "This record does not authorize payment now."}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-ivory-muted">
        Historical validity does not imply current authorization. Freshness describes what this verifier
        could reach, not proof that no newer record exists.
      </p>
    </div>
  );
}

function Check({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-ivory/[0.06] pb-2 last:border-0">
      <span className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-accent/50 text-[8px] text-accent-bright">
        ✓
      </span>
      <div>
        <div className="text-[11.5px] leading-snug text-ivory">{label}</div>
        <div className="mt-0.5 break-all font-mono text-[9px] text-ivory-muted">{detail}</div>
      </div>
    </div>
  );
}

function Digest({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">{label}</span>
        <CopyButton value={value} />
      </div>
      <div className="mt-1 break-all font-mono text-[9.5px] leading-relaxed text-ivory-dim">{value}</div>
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">{label}</dt>
      <dd className="mt-1 break-all font-mono text-[10px] text-ivory">{value}</dd>
    </div>
  );
}
