"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeNostrPublicKey } from "@kyvera/nostr";
import { resolveAddress, type AddressResolution, type IdentityResolution } from "@kyvera/verifier";
import { DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { refreshIdentity } from "@/lib/identity";
import { RelayEditor } from "@/components/relay-editor";
import { AddressResolutionPanel, ResolutionPanel } from "@/components/resolution";
import { Alert, Button, Card, Input, SectionLabel, Spinner, cn } from "@/components/ui";

type Mode = "identity" | "address";

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-5 py-16 text-slate-500">Loading verifier…</div>}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const search = useSearchParams();
  const initial = search.get("npub") ?? search.get("address") ?? "";
  const initialMode: Mode = search.get("address") ? "address" : "identity";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [input, setInput] = useState(initial);
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [identity, setIdentity] = useState<IdentityResolution | null>(null);
  const [address, setAddress] = useState<AddressResolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) void run(initialMode, initial);
    // Only on first load with a deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(targetMode: Mode = mode, value: string = input) {
    setError("");
    setIdentity(null);
    setAddress(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter an npub, a hex public key, or a BCH address.");
      return;
    }
    setLoading(true);
    try {
      if (targetMode === "identity") {
        const subject = normalizeNostrPublicKey(trimmed);
        if (!subject) throw new Error("Not a valid npub or 32-byte hex Nostr public key.");
        setIdentity(await refreshIdentity(subject, relays, NETWORK));
      } else {
        setAddress(await resolveAddress({ address: trimmed, relays, network: NETWORK }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
          Public verifier
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Inspect an identity. Trust the signatures, not the site.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">
          The verifier fetches signed records from independent relays, validates both keys, walks the
          authorization chain and reports uncertainty explicitly. Nothing is sent to a KYVERA server.
        </p>
      </div>

      <Card className="mt-8 p-5">
        <div className="mb-4 flex rounded-lg border border-white/10 p-0.5 sm:w-fit">
          {(["identity", "address"] as const).map((value) => (
            <button
              key={value}
              onClick={() => {
                setMode(value);
                setIdentity(null);
                setAddress(null);
                setError("");
              }}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-[12px] capitalize transition-colors sm:flex-none",
                mode === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white",
              )}
            >
              {value === "identity" ? "Nostr identity" : "BCH address"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void run();
            }}
            placeholder={
              mode === "identity" ? "npub1… or 64-char hex public key" : "bitcoincash:q… or bchtest:q…"
            }
            spellCheck={false}
            className="font-mono text-[12px]"
          />
          <Button onClick={() => void run()} disabled={loading} className="shrink-0">
            {loading ? <Spinner /> : null} Verify
          </Button>
        </div>

        <div className="mt-4">
          <SectionLabel>Relays</SectionLabel>
          <RelayEditor relays={relays} onChange={setRelays} />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          {mode === "identity"
            ? "Identity resolution requires the full history. A relay that returns only part of the chain produces STALE, never an older ACTIVE binding."
            : "Address lookup finds bindings that mention the address, then resolves each identity's full chain. Historical addresses are reported as SUPERSEDED."}
        </p>
      </Card>

      {error ? (
        <div className="mt-5">
          <Alert tone="danger" title="Verification could not run">
            {error}
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <Card className="mt-5 flex items-center gap-3 p-8 text-[13px] text-slate-400">
          <Spinner /> Querying relays and verifying proofs…
        </Card>
      ) : identity ? (
        <div className="mt-5">
          <ResolutionPanel resolution={identity} />
        </div>
      ) : address ? (
        <div className="mt-5">
          <AddressResolutionPanel result={address} />
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Signatures", "BIP-340 Schnorr for Nostr, compact recoverable ECDSA for BCH. Keys are recovered, never trusted."],
          ["Chain", "Each record commits to the previous record digest. Sequence gaps are STALE."],
          ["Uncertainty", "Relay failures reduce assurance. No relay means STALE, even with cached history."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-white/[0.07] bg-ink-900/50 p-4">
            <div className="text-[12px] font-medium text-white">{title}</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
