"use client";

import type { ChainStep } from "@kyvera/core";
import type { AddressResolution, IdentityResolution } from "@kyvera/verifier";
import { Badge, Card, CopyButton, Divider, SectionLabel, StatusBadge, cn } from "./ui";
import { CATEGORY, STATUS_LABEL, shortAddress, shortHex, statusClasses, timestamp, timestampShort } from "@/lib/format";

function StepRow({ step, index, head }: { step: ChainStep; index: number; head: boolean }) {
  const payload = step.record.payload;
  return (
    <li className="relative pl-6">
      <span
        className={cn(
          "absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border",
          head ? "border-accent bg-accent/70" : "border-ivory/25 bg-ink-800",
        )}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[12px] text-muted">#{payload.sequence}</span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            payload.type === "bind" && "border-accent/30 bg-accent/10 text-accent-bright",
            payload.type === "rotate" && "border-signal/30 bg-signal/10 text-signal-bright",
            payload.type === "revoke" && "border-danger/30 bg-danger/10 text-[#E5A49C]",
          )}
        >
          {payload.type}
        </span>
        {head ? <span className="text-[11px] text-accent">head</span> : null}
        <span className="text-[11px] text-muted">{timestamp(payload.issuedAt)}</span>
      </div>
      <div className="mt-1 font-mono text-[12px] text-ivory-dim">
        {payload.bch ? payload.bch.address : "no payment address (revoked)"}
      </div>
      <div className="mt-0.5 text-[10.5px] text-ivory-muted/70">
        record {shortHex(step.recordId, 10, 8)}
        {index === 0 ? " · genesis" : ""}
      </div>
    </li>
  );
}

export function ResolutionPanel({
  resolution,
  compact = false,
}: {
  resolution: IdentityResolution;
  compact?: boolean;
}) {
  const status = resolution.status;
  const active = resolution.activeBch;
  return (
    <div className="space-y-4 animate-fade">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ivory/[0.06] p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <Badge tone={resolution.assurance === "FULL" ? "accent" : resolution.assurance === "PARTIAL" ? "warn" : "danger"}>
                {resolution.assurance} sync
              </Badge>
              <span className="text-[11px] text-muted">
                {resolution.sync.responded}/{resolution.sync.total} relays
              </span>
            </div>
            <p className="max-w-2xl text-[13px] leading-relaxed text-ivory-dim">{resolution.reason}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              {CATEGORY[status]}
            </div>
            <div className="mt-1 font-mono text-[11px] text-ivory-muted">{resolution.reasonCode}</div>
          </div>
        </div>

        {active ? (
          <div className="grid gap-4 border-b border-ivory/[0.06] bg-accent/[0.025] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/80">
                {status === "EXPIRED" ? "Last authorized BCH identity (expired)" : "Currently authorized BCH identity"}
              </div>
              <div className="mt-1.5 break-all font-mono text-[15px] text-ivory">{active.address}</div>
              <div className="mt-1 text-[11px] text-muted">{active.network} · P2PKH</div>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton value={active.address} />
            </div>
          </div>
        ) : (
          <div className="border-b border-ivory/[0.06] bg-danger/[0.02] p-5 text-[12.5px] text-ivory-muted">
            No payment address can be asserted as current. {status === "REVOKED" ? "This identity was revoked." : "The verifier refuses to fall back to a historical binding."}
          </div>
        )}

        <div className="grid gap-px bg-ivory/[0.06] sm:grid-cols-4">
          <Metric label="Sequence" value={resolution.head ? `#${resolution.head.record.payload.sequence}` : "—"} />
          <Metric label="Head issued (UTC)" value={timestampShort(resolution.headIssuedAt)} />
          <Metric label="Checked (UTC)" value={timestampShort(resolution.checkedAt)} />
          <Metric label="Records" value={String(resolution.history.length)} />
        </div>

        {!compact ? (
          <div className="p-5">
            <SectionLabel>Authorization history</SectionLabel>
            {resolution.history.length === 0 ? (
              <p className="text-[12.5px] text-ivory-muted">No valid chain was established.</p>
            ) : (
              <ol className="space-y-4 border-l border-ivory/[0.08] pl-3">
                {resolution.history.map((step, index) => (
                  <StepRow
                    key={step.recordId}
                    step={step}
                    index={index}
                    head={index === resolution.history.length - 1}
                  />
                ))}
              </ol>
            )}

            {resolution.superseded.length > 0 ? (
              <>
                <Divider />
                <div className="pt-5">
                  <SectionLabel>Superseded addresses</SectionLabel>
                  <div className="space-y-2">
                    {resolution.superseded.map((entry) => (
                      <div
                        key={`${entry.recordId}-${entry.address}`}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-ivory/[0.07] bg-ink-900/60 px-3 py-2 font-mono text-[11.5px]"
                      >
                        <span className="text-ivory-dim">{shortAddress(entry.address)}</span>
                        <span className="text-ivory-muted/70">→</span>
                        <span className={entry.replacedBy === "revoked" ? "text-[#E5A49C]" : "text-accent"}>
                          {entry.replacedBy === "revoked" ? "revoked" : shortAddress(entry.replacedBy)}
                        </span>
                        <span className="ml-auto text-[10px] text-ivory-muted/70">seq #{entry.sequence}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {resolution.conflict ? (
              <>
                <Divider />
                <div className="pt-5">
                  <SectionLabel>Equivocation evidence</SectionLabel>
                  <p className="text-[12px] text-[#E5A49C]">
                    Sequence {resolution.conflict.sequence} has {resolution.conflict.recordIds.length} competing
                    valid records.
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-[10.5px] text-ivory-muted">
                    {resolution.conflict.recordIds.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Relay synchronization</SectionLabel>
          <div className="space-y-2">
            {resolution.sync.relays.length === 0 ? (
              <p className="text-[12px] text-ivory-muted">No relays configured.</p>
            ) : (
              resolution.sync.relays.map((relay) => (
                <div key={relay.url} className="flex items-center gap-2.5 text-[12px]">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      relay.ok ? (relay.eose ? "bg-accent" : "bg-signal") : "bg-danger",
                    )}
                  />
                  <span className="truncate font-mono text-ivory-dim">{relay.url}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-ivory-muted">
                    {relay.ok ? `${relay.events} ev · ${relay.latencyMs}ms${relay.eose ? "" : " · no EOSE"}` : relay.error ?? "failed"}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Rejected records</SectionLabel>
          {resolution.rejected.length === 0 ? (
            <p className="text-[12px] text-ivory-muted">
              Every KYVERA event fetched from the relays passed verification.
            </p>
          ) : (
            <ul className="space-y-2">
              {resolution.rejected.slice(0, 6).map((entry, index) => (
                <li key={`${entry.eventId}-${index}`} className="text-[11.5px] leading-relaxed">
                  <span className="font-mono text-[10px] uppercase text-[#E5A49C]">{entry.code}</span>
                  <span className="ml-2 text-ivory-muted">{entry.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <details className="group rounded-xl border border-ivory/[0.07] bg-ink-900/50">
        <summary className="cursor-pointer select-none px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Machine-readable result
        </summary>
        <pre className="scroll-pane max-h-[420px] overflow-auto border-t border-ivory/[0.06] p-5 text-[10.5px] leading-relaxed text-ivory-muted">
          {JSON.stringify(resolution, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-850 px-5 py-3.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ivory-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-[10px] text-ivory-dim">{value}</div>
    </div>
  );
}

export function AddressResolutionPanel({ result }: { result: AddressResolution }) {
  const tone =
    result.status === "ACTIVE"
      ? "accent"
      : result.status === "SUPERSEDED" || result.status === "EXPIRED"
        ? "warn"
        : result.status === "UNKNOWN"
          ? "neutral"
          : "danger";
  return (
    <div className="space-y-4 animate-fade">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={tone}>{STATUS_LABEL[result.status]}</Badge>
              <Badge tone={result.assurance === "FULL" ? "accent" : "warn"}>{result.assurance} sync</Badge>
              <span className="text-[11px] text-muted">
                {result.sync.responded}/{result.sync.total} relays
              </span>
            </div>
            <div className="break-all font-mono text-[14px] text-ivory">{result.address}</div>
            <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ivory-muted">{result.reason}</p>
          </div>
        </div>
        <div className="border-t border-ivory/[0.06]">
          {result.bindings.length === 0 ? (
            <p className="p-5 text-[12.5px] text-ivory-muted">No KYVERA identity references this address.</p>
          ) : (
            <ul className="divide-y divide-ivory/[0.06]">
              {result.bindings.map((binding) => (
                <li key={binding.subject} className="flex flex-wrap items-center gap-3 p-4">
                  <span className={cn("rounded border px-2 py-1 text-[10px] uppercase tracking-wider", statusClasses(binding.status))}>
                    {STATUS_LABEL[binding.status]}
                  </span>
                  <a
                    href={`/identity/${binding.subject}`}
                    className="font-mono text-[11.5px] text-ivory-dim hover:text-accent"
                  >
                    {shortHex(binding.subject, 16, 10)}
                  </a>
                  <span className="text-[11px] text-muted">
                    current: {binding.currentAddress ? shortAddress(binding.currentAddress) : "none"}
                  </span>
                  <span className="ml-auto text-[10.5px] text-ivory-muted/70">{binding.reasonCode}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
