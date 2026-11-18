"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { SignedRecord } from "@kyvera/core";
import { normalizeNostrPublicKey, publishToRelays, toNpub } from "@kyvera/nostr";
import type { IdentityResolution } from "@kyvera/verifier";
import { DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { shortAddress, shortHex, timestamp } from "@/lib/format";
import {
  refreshIdentity,
  revokeDemoIdentity,
  rotateDemoIdentity,
} from "@/lib/identity";
import { getIdentity, type StoredIdentity } from "@/lib/store";
import { RelayEditor } from "@/components/relay-editor";
import { ResolutionPanel } from "@/components/resolution";
import { TimeMachine } from "@/components/time-machine";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Divider,
  Input,
  SectionLabel,
  Spinner,
  cn,
} from "@/components/ui";

export default function IdentityPage() {
  const params = useParams<{ npub: string }>();
  const raw = Array.isArray(params.npub) ? params.npub[0] : params.npub;
  const subject = useMemo(() => (raw ? normalizeNostrPublicKey(decodeURIComponent(raw)) : null), [raw]);

  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [resolution, setResolution] = useState<IdentityResolution | null>(null);
  const [stored, setStored] = useState<StoredIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"none" | "rotate" | "revoke">("none");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [republishing, setRepublishing] = useState(false);
  const load = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    setError("");
    try {
      const result = await refreshIdentity(subject, relays, NETWORK);
      setResolution(result);
      setStored(getIdentity(subject));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [subject, relays]);

  useEffect(() => {
    void load();
  }, [load]);

  const headRecord: SignedRecord | null = resolution?.head?.record ?? null;
  const canControl = Boolean(stored && stored.nostrSecret && stored.bchKeys.length > 0);
  const canAct = canControl && resolution?.status === "ACTIVE" && headRecord !== null;

  async function onRotate() {
    if (!stored || !headRecord) return;
    setBusy(true);
    setActionMessage("");
    try {
      const result = await rotateDemoIdentity(stored, headRecord, relays, NETWORK);
      setActionMessage(`Rotated to ${result.newAddress}. The previous wallet is now superseded.`);
      setAction("none");
      setConfirmText("");
      await load();
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke() {
    if (!stored || !headRecord) return;
    setBusy(true);
    setActionMessage("");
    try {
      await revokeDemoIdentity(stored, headRecord, relays);
      setActionMessage("The identity was revoked. No payment address is current.");
      setAction("none");
      setConfirmText("");
      await load();
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function republish() {
    if (!stored) return;
    setRepublishing(true);
    try {
      for (const event of stored.events) {
        await publishToRelays(relays, event);
      }
      setActionMessage(`Re-published ${stored.events.length} local record(s).`);
      await load();
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRepublishing(false);
    }
  }

  if (!subject) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Alert tone="danger" title="Invalid identity">
          The URL does not contain a valid npub or 32-byte hex public key.
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
            Identity dashboard
          </div>
          <h1 className="mt-2 break-all font-mono text-[14px] leading-relaxed text-ivory sm:text-[17px]">{toNpub(subject)}</h1>
          <p className="mt-1 break-all font-mono text-[10px] text-ivory-muted">{subject}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CopyButton value={raw ?? subject} label="Copy npub" />
            <CopyButton value={subject} label="Copy hex" />
            {stored ? (
              <Badge tone={stored.mode === "demo" ? "warn" : "accent"}>
                {stored.mode === "demo" ? "local demo identity" : "external signer"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/verify?npub=${encodeURIComponent(raw ?? subject)}`}
            className="rounded-lg border border-ivory/12 bg-ivory/[0.03] px-3.5 py-2 text-[12.5px] text-ivory-dim hover:border-ivory/25"
          >
            Public verifier
          </Link>
          <Link
            href={`/identity/${encodeURIComponent(raw ?? subject)}/time-machine`}
            className="rounded-lg border border-ivory/12 bg-ivory/[0.03] px-3.5 py-2 text-[12.5px] text-ivory-dim hover:border-ivory/25"
          >
            Full time machine
          </Link>
          <Link
            href={`/auth?npub=${encodeURIComponent(raw ?? subject)}`}
            className="rounded-lg border border-ivory/12 bg-ivory/[0.03] px-3.5 py-2 text-[12.5px] text-ivory-dim hover:border-ivory/25"
          >
            Test authentication
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {loading ? (
            <Card className="flex items-center gap-3 p-8 text-[13px] text-ivory-muted">
              <Spinner /> Resolving from {relays.length} relay{relays.length === 1 ? "" : "s"}…
            </Card>
          ) : error ? (
            <Alert tone="danger" title="Resolution failed">
              {error}
            </Alert>
          ) : resolution ? (
            <>
              <ResolutionPanel resolution={resolution} compact />
              <TimeMachine resolution={resolution} />
            </>
          ) : null}

          {actionMessage ? <Alert tone="info">{actionMessage}</Alert> : null}

          {stored && canControl ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <SectionLabel>Lifecycle controls</SectionLabel>
                <Badge tone="warn">demo keys in browser</Badge>
              </div>
              <p className="text-[12.5px] leading-relaxed text-ivory-muted">
                This browser holds the Nostr key and every BCH key it generated, so it can produce the
                two-signature rotation authorization. Actions are enabled only when the resolved state is
                ACTIVE; rotating from a stale or conflicting head could fork the identity.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-ivory/[0.08] bg-ink-900/60 p-4">
                  <div className="text-[13px] font-medium text-ivory">Rotate BCH wallet</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ivory-muted">
                    The current wallet and the Nostr key authorize a new address. The old address becomes
                    SUPERSEDED, never ACTIVE.
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-3 w-full"
                    disabled={!canAct || busy}
                    onClick={() => {
                      setAction("rotate");
                      setConfirmText("");
                    }}
                  >
                    Prepare rotation
                  </Button>
                </div>
                <div className="rounded-lg border border-danger/20 bg-danger/[0.03] p-4">
                  <div className="text-[13px] font-medium text-ivory">Revoke identity</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ivory-muted">
                    Signed by the current BCH wallet and the Nostr key. Revocation ends the chain; later
                    records are rejected as CONFLICT.
                  </p>
                  <Button
                    variant="danger"
                    className="mt-3 w-full"
                    disabled={!canAct || busy}
                    onClick={() => {
                      setAction("revoke");
                      setConfirmText("");
                    }}
                  >
                    Revoke binding
                  </Button>
                </div>
              </div>

              {!canAct ? (
                <p className="mt-3 text-[11px] text-signal-bright/80">
                  Controls are locked while the resolved status is {resolution?.status ?? "unknown"}.
                </p>
              ) : null}

              {action !== "none" ? (
                <div className="mt-5 rounded-lg border border-ivory/[0.09] bg-ink-950/60 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-ivory">
                      {action === "rotate" ? "Confirm rotation" : "Confirm revocation"}
                    </div>
                    <button
                      onClick={() => setAction("none")}
                      className="text-[11px] text-ivory-muted hover:text-ivory"
                    >
                      Cancel
                    </button>
                  </div>

                  {action === "rotate" ? (
                    <div className="mt-3 space-y-3">
                      <div className="text-[12px] text-ivory-muted">
                        <span className="text-muted">Current:</span>{" "}
                        <span className="font-mono text-ivory-dim">
                          {resolution?.activeBch?.address ?? "—"}
                        </span>
                      </div>
                      <div className="text-[12px] text-ivory-muted">
                        <span className="text-muted">Next:</span> a fresh demo keypair generated in this
                        browser
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-ivory-muted">
                        This publishes one rotate record at sequence{" "}
                        {(resolution?.head?.record.payload.sequence ?? 0) + 1}, signed by the current BCH
                        key, the new BCH key and your Nostr key.
                      </p>
                      <Button onClick={onRotate} disabled={busy}>
                        {busy ? <Spinner /> : null} Rotate now
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <Alert tone="danger" title="Irreversible within this identity">
                        A revocation cannot be undone. Future rotations after it are rejected. To start
                        over you would need a new Nostr identity and a new genesis binding.
                      </Alert>
                      <Input
                        value={confirmText}
                        onChange={(event) => setConfirmText(event.target.value)}
                        placeholder="Type REVOKE to confirm"
                        spellCheck={false}
                      />
                      <Button
                        variant="danger"
                        onClick={onRevoke}
                        disabled={busy || confirmText !== "REVOKE"}
                      >
                        {busy ? <Spinner /> : null} Revoke permanently
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          ) : stored ? (
            <Card className="p-5">
              <SectionLabel>Lifecycle controls</SectionLabel>
              <p className="text-[12.5px] leading-relaxed text-ivory-muted">
                This identity uses a NIP-07 or external BCH signer. Rotation and revocation require
                signatures from the current BCH wallet, which this browser does not hold.
              </p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                Use the open SDK to build the transition with your wallet&apos;s signmessage output. The
                verifier applies the same rules regardless of which client produced the record.
              </p>
              <Link href="/developers" className="mt-3 inline-block text-[12px] text-accent hover:text-accent-bright">
                See the rotation API →
              </Link>
            </Card>
          ) : null}

          {stored && stored.events.length > 0 ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <SectionLabel>Local record ledger</SectionLabel>
                  <p className="text-[12px] text-ivory-muted">
                    {stored.events.length} signed event{stored.events.length === 1 ? "" : "s"} cached in
                    this browser.
                  </p>
                </div>
                <Button variant="secondary" onClick={republish} disabled={republishing}>
                  {republishing ? <Spinner /> : null} Re-publish to relays
                </Button>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-[11px] text-ivory-muted hover:text-ivory-dim">
                  Show local event ids
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-[10px] text-ivory-muted/70">
                  {stored.events.map((event) => (
                    <li key={event.id}>
                      {shortHex(event.id, 16, 10)} · kind {event.kind} · {timestamp(event.created_at)}
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <SectionLabel>Relays</SectionLabel>
            <RelayEditor relays={relays} onChange={setRelays} compact />
            <Button variant="secondary" className="mt-3 w-full" onClick={() => void load()}>
              Refresh state
            </Button>
          </Card>

          <Card className="p-5">
            <SectionLabel>Summary</SectionLabel>
            {resolution ? (
              <div className="space-y-2 text-[12px]">
                <Row label="Status" value={resolution.status} />
                <Row label="Assurance" value={resolution.assurance} />
                <Row label="Sequence" value={resolution.head ? `#${resolution.head.record.payload.sequence}` : "—"} />
                <Row label="Address" value={shortAddress(resolution.activeBch?.address)} />
                <Row label="History" value={`${resolution.history.length} records`} />
                <Row label="Rejected" value={String(resolution.rejected.length)} />
              </div>
            ) : (
              <p className="text-[12px] text-ivory-muted">Not resolved yet.</p>
            )}
            <Divider />
            <p className="text-[10.5px] leading-relaxed text-ivory-muted/70">
              Verification is performed locally from signed events. Relays are untrusted transport.
            </p>
          </Card>

          <Card className="p-5">
            <SectionLabel>Independent check</SectionLabel>
            <pre className="scroll-pane overflow-auto whitespace-pre-wrap break-all rounded-lg border border-ivory/[0.07] bg-ink-950/60 p-3 font-mono text-[10px] leading-relaxed text-ivory-muted">
{`pnpm cli ${raw ?? ""} \\
  --relay ${relays[0] ?? "wss://relay.damus.io"}`}
            </pre>
            <CopyButton
              value={`pnpm cli ${raw ?? ""} --relay ${relays[0] ?? "wss://relay.damus.io"}`}
              label="Copy command"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3")}>
      <span className="text-muted">{label}</span>
      <span className="truncate font-mono text-[11px] text-ivory-dim">{value}</span>
    </div>
  );
}
