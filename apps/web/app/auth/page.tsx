"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { KyveraEvent } from "@kyvera/core";
import { normalizeNostrPublicKey, signerFromSecretKey } from "@kyvera/nostr";
import { hexToBytes } from "@kyvera/bch";
import {
  ChallengeService,
  buildAuthEvent,
  type AuthChallenge,
  type AuthCheck,
  type IdentityResolution,
} from "@kyvera/verifier";
import { AUTH_DOMAIN, DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { refreshIdentity } from "@/lib/identity";
import { getNip07Provider, nip07Signer } from "@/lib/nip07";
import { getIdentity } from "@/lib/store";
import { timestamp } from "@/lib/format";
import { RelayEditor } from "@/components/relay-editor";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Input,
  SectionLabel,
  Spinner,
  cn,
} from "@/components/ui";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-5 py-16 text-ivory-muted">Loading…</div>}>
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const search = useSearchParams();
  const [input, setInput] = useState(search.get("npub") ?? "");
  const [expectedAddress, setExpectedAddress] = useState("");
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [resolution, setResolution] = useState<IdentityResolution | null>(null);
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [event, setEvent] = useState<KyveraEvent | null>(null);
  const [check, setCheck] = useState<AuthCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const service = useRef<ChallengeService | null>(null);

  if (!service.current) {
    service.current = new ChallengeService({ domain: AUTH_DOMAIN, ttlSeconds: 300 });
  }

  useEffect(() => {
    if (search.get("npub")) void resolve(input);
    // Deep link only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(target: string = input) {
    setError("");
    setResolution(null);
    setChallenge(null);
    setEvent(null);
    setCheck(null);
    setLoading(true);
    try {
      const subject = normalizeNostrPublicKey(target.trim());
      if (!subject) throw new Error("Not a valid npub or hex public key.");
      setResolution(await refreshIdentity(subject, relays, NETWORK));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  function issueChallenge() {
    setError("");
    setCheck(null);
    setEvent(null);
    setChallenge(service.current!.issue());
  }

  async function signAndVerify() {
    setError("");
    setCheck(null);
    if (!challenge || !resolution) return;
    try {
      const stored = getIdentity(resolution.subject);
      let signer;
      if (stored?.nostrSecret) {
        signer = signerFromSecretKey(hexToBytes(stored.nostrSecret));
      } else {
        const provider = getNip07Provider();
        if (!provider) {
          throw new Error(
            "No signer in this browser. This tab does not hold the demo key, and no NIP-07 extension was detected.",
          );
        }
        signer = nip07Signer(provider);
      }
      const signed = await buildAuthEvent({
        challenge,
        signer,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setEvent(signed);
      const result = service.current!.verify(
        signed,
        resolution,
        expectedAddress.trim() ? expectedAddress.trim().toLowerCase() : undefined,
      );
      setCheck(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
          Authentication
        </div>
        <h1 className="mt-3 font-display text-[38px] leading-[1.05] tracking-editorial text-ivory">
          Prove the key is live. Not just that it exists.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ivory-muted">
          A relying application issues a short-lived challenge. The user signs it with the identity&apos;s
          Nostr key, and the application checks the signature against the currently authorized state — no
          account, session server or KYVERA backend.
        </p>
        <Link
          href="/auth-demo"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-signal/35 bg-signal/[0.05] px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-signal-bright hover:bg-signal/[0.1]"
        >
          Open the independent relying-party demo →
        </Link>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <SectionLabel>01 · Resolve identity</SectionLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="npub1…"
                spellCheck={false}
                className="font-mono text-[12px]"
              />
              <Button onClick={() => void resolve()} disabled={loading} className="shrink-0">
                {loading ? <Spinner /> : null} Resolve
              </Button>
            </div>
            <div className="mt-3">
              <RelayEditor relays={relays} onChange={setRelays} compact />
            </div>
            {error ? (
              <div className="mt-3">
                <Alert tone="danger">{error}</Alert>
              </div>
            ) : null}

            {resolution ? (
              <div className="mt-4 space-y-2 rounded-lg border border-ivory/[0.07] bg-ink-900/60 p-3.5 text-[11.5px]">
                <div className="flex items-center gap-2">
                  <Badge tone={resolution.status === "ACTIVE" ? "accent" : "danger"}>
                    {resolution.status}
                  </Badge>
                  <span className="text-muted">{resolution.assurance} sync</span>
                </div>
                <div className="break-all font-mono text-[10.5px] text-ivory-muted">{resolution.subject}</div>
                <div className="text-ivory-muted">
                  current BCH:{" "}
                  <span className="font-mono text-ivory-dim">
                    {resolution.activeBch?.address ?? "none"}
                  </span>
                </div>
                <div className="text-[10.5px] text-ivory-muted">
                  Only ACTIVE identities may authenticate. Revoked, expired, stale and conflicting states
                  are rejected before any token is issued.
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <SectionLabel>02 · Issue a challenge</SectionLabel>
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ivory-muted">
              Domain <span className="font-mono text-accent">{AUTH_DOMAIN}</span> · TTL 300s · kind 22242
            </div>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={issueChallenge}
              disabled={!resolution}
            >
              Create challenge
            </Button>
            {challenge ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">Challenge</span>
                  <CopyButton value={challenge.challenge} />
                </div>
                <div className="break-all rounded-lg border border-ivory/[0.07] bg-ink-950/70 p-3 font-mono text-[10.5px] text-accent-bright/90">
                  {challenge.challenge}
                </div>
                <div className="text-[10.5px] text-ivory-muted">
                  issued {timestamp(challenge.issuedAt)} · expires {timestamp(challenge.expiresAt)}
                </div>

                <div className="pt-2">
                  <label className="mb-1 block text-[11px] text-ivory-muted">
                    Optional: require the current payment address
                  </label>
                  <Input
                    value={expectedAddress}
                    onChange={(event) => setExpectedAddress(event.target.value)}
                    placeholder="bitcoincash:q…"
                    spellCheck={false}
                    className="font-mono text-[11px]"
                  />
                </div>

                <Button className="mt-2 w-full" onClick={signAndVerify} disabled={!resolution}>
                  Sign and verify
                </Button>
                <p className="text-[10.5px] leading-relaxed text-muted">
                  This tab signs with the stored demo key when available; otherwise it asks a NIP-07
                  extension. The challenge is single-use in this session.
                </p>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionLabel>Result</SectionLabel>
            {check ? (
              <div
                className={cn(
                  "rounded-lg border p-4",
                  check.authenticated
                    ? "border-accent/30 bg-accent/[0.06]"
                    : "border-danger/30 bg-danger/[0.05]",
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge tone={check.authenticated ? "accent" : "danger"}>
                    {check.authenticated ? "Authenticated" : "Rejected"}
                  </Badge>
                  <span className="font-mono text-[10.5px] text-ivory-muted">{check.code}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ivory-dim">{check.message}</p>
                {check.bchAddress ? (
                  <div className="mt-2 break-all font-mono text-[10.5px] text-ivory-muted">
                    BCH {check.bchAddress}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-ivory-muted">
                No authentication attempt yet. A successful result means: valid Schnorr signature, exact
                challenge, correct domain, inside the time window, ACTIVE identity, and — if requested —
                the expected payment address.
              </p>
            )}

            {event ? (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    Signed authentication event
                  </span>
                  <CopyButton value={JSON.stringify(event, null, 2)} />
                </div>
                <pre className="scroll-pane max-h-72 overflow-auto rounded-lg border border-ivory/[0.07] bg-ink-950/70 p-3 font-mono text-[10px] leading-relaxed text-ivory-muted">
{JSON.stringify(event, null, 2)}
                </pre>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <SectionLabel>What this proves</SectionLabel>
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-ivory-muted">
              <li>◆ The signer controls the Nostr key that authored the latest authorized record.</li>
              <li>◆ The identity is currently ACTIVE — not revoked, expired or ambiguous.</li>
              <li>◆ The challenge was issued for this domain and used inside its window.</li>
              <li>◆ Optionally, the identity still points at the BCH address the app expects.</li>
            </ul>
            <p className="mt-3 text-[10.5px] leading-relaxed text-ivory-muted">
              Replay protection is stateful by design: the relying app must store used challenges for the
              TTL. The SDK ships an in-memory registry for examples; production apps should persist it.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
