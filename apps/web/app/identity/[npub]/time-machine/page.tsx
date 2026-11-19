"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { normalizeNostrPublicKey, toNpub } from "@kyvera/nostr";
import type { IdentityResolution } from "@kyvera/verifier";
import { DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { refreshIdentity } from "@/lib/identity";
import { RelayEditor } from "@/components/relay-editor";
import { TimeMachine } from "@/components/time-machine";
import { Alert, Button, Card, CopyButton, SectionLabel, Spinner } from "@/components/ui";

export default function TimeMachinePage() {
  const params = useParams<{ npub: string }>();
  const raw = Array.isArray(params.npub) ? params.npub[0] : params.npub;
  const subject = useMemo(() => (raw ? normalizeNostrPublicKey(decodeURIComponent(raw)) : null), [raw]);
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [resolution, setResolution] = useState<IdentityResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    setError("");
    try {
      setResolution(await refreshIdentity(subject, relays, NETWORK));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [subject, relays]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="mx-auto max-w-[1240px] px-5 py-12">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="kicker text-signal">Identity time machine</div>
          <h1 className="mt-3 max-w-3xl font-display text-[34px] leading-[1.1] tracking-editorial text-ivory sm:text-[42px]">
            Every transition, with its evidence attached.
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ivory-dim">
            Inspect each signed record, its predecessor digest, both proofs and the relays that supplied
            it. Validity is shown separately from current authorization and relay freshness.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-[10px] text-ivory-muted">{toNpub(subject)}</span>
            <CopyButton value={raw ?? subject} label="Copy npub" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/identity/${encodeURIComponent(raw ?? subject)}`}
            className="rounded-full border border-ivory/20 px-3.5 py-2 text-[12px] text-ivory-dim hover:border-ivory/45 hover:text-ivory"
          >
            ← Dashboard
          </Link>
          <Link
            href={`/verify?npub=${encodeURIComponent(raw ?? subject)}`}
            className="rounded-full border border-ivory/20 px-3.5 py-2 text-[12px] text-ivory-dim hover:border-ivory/45 hover:text-ivory"
          >
            Public verifier
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {loading ? (
            <Card className="flex items-center gap-3 p-8 text-[13px] text-ivory-dim">
              <Spinner /> Resolving from {relays.length} relay{relays.length === 1 ? "" : "s"}…
            </Card>
          ) : error ? (
            <Alert tone="danger" title="Resolution failed">
              {error}
            </Alert>
          ) : resolution ? (
            <TimeMachine resolution={resolution} />
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="p-5 lg:sticky lg:top-24">
            <SectionLabel>Relays</SectionLabel>
            <RelayEditor relays={relays} onChange={setRelays} compact />
            <Button variant="secondary" className="mt-3 w-full" onClick={() => void load()}>
              Refresh evidence
            </Button>
            {resolution ? (
              <div className="mt-4 space-y-2 border-t border-ivory/[0.08] pt-4 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ivory-muted">
                <div className="flex justify-between gap-2">
                  <span>state</span>
                  <span className="text-ivory">{resolution.status}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>assurance</span>
                  <span className="text-ivory">{resolution.assurance}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>records</span>
                  <span className="text-ivory">{resolution.history.length}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>excluded</span>
                  <span className="text-ivory">{resolution.rejected.length}</span>
                </div>
              </div>
            ) : null}
            <p className="mt-4 text-[10px] leading-relaxed text-ivory-muted">
              Relay observations show what was reachable. They cannot prove that no newer record exists
              without a checkpoint from a previous verification.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
