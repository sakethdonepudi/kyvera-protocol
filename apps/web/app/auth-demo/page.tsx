"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { hexToBytes } from "@kyvera/bch";
import { normalizeNostrPublicKey, signerFromSecretKey, toNpub } from "@kyvera/nostr";
import {
  AuthRequestService,
  authRequestDigest,
  buildAuthRequestEvent,
  resolveEvents,
  type AppSession,
  type AuthRequest,
} from "@kyvera/verifier";
import type { IdentityResolution } from "@kyvera/verifier";
import type { KyveraEvent } from "@kyvera/core";
import { DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { refreshIdentity, revokeDemoIdentity, rotateDemoIdentity } from "@/lib/identity";
import { getIdentity, listIdentities, type StoredIdentity } from "@/lib/store";
import { getLabFixtures, LAB_NOW } from "@/lib/lab";
import { shortAddress, shortHex, timestamp } from "@/lib/format";
import { getNip07Provider, nip07Signer } from "@/lib/nip07";
import { RelayEditor } from "@/components/relay-editor";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  GlassPanel,
  Input,
  SectionLabel,
  Spinner,
  StatusBadge,
  cn,
} from "@/components/ui";

export default function AuthDemoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-5 py-16 text-ivory-muted">Loading relying party…</div>}>
      <AuthDemoInner />
    </Suspense>
  );
}

function AuthDemoInner() {
  const search = useSearchParams();
  const [input, setInput] = useState(search.get("npub") ?? "");
  const [subject, setSubject] = useState<string | null>(null);
  const [resolution, setResolution] = useState<IdentityResolution | null>(null);
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [request, setRequest] = useState<AuthRequest | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [lastEvent, setLastEvent] = useState<KyveraEvent | null>(null);
  const [check, setCheck] = useState<{ code: string; message: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [local, setLocal] = useState<StoredIdentity[]>([]);
  const [originHost, setOriginHost] = useState("");
  const [securityResult, setSecurityResult] = useState<{ label: string; ok: boolean; detail: string } | null>(null);
  const serviceRef = useRef<AuthRequestService | null>(null);

  function service(): AuthRequestService {
    if (!serviceRef.current) {
      serviceRef.current = new AuthRequestService({
        origin: window.location.origin,
        domain: window.location.host,
        ttlSeconds: 120,
        sessionTtlSeconds: 900,
      });
    }
    return serviceRef.current;
  }

  useEffect(() => {
    setLocal(listIdentities());
    setOriginHost(window.location.host);
    if (search.get("npub")) void resolve(search.get("npub")!);
    // Deep link only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(target = input) {
    setError("");
    setCheck(null);
    setRequest(null);
    setSecurityResult(null);
    setBusy(true);
    try {
      const normalized = normalizeNostrPublicKey(target.trim());
      if (!normalized) throw new Error("Enter a valid npub or 32-byte hex public key.");
      setSubject(normalized);
      setResolution(await refreshIdentity(normalized, relays, NETWORK));
      setInput(target);
      setLocal(listIdentities());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function refreshResolution(): Promise<IdentityResolution | null> {
    if (!subject) return null;
    const fresh = await refreshIdentity(subject, relays, NETWORK);
    setResolution(fresh);
    return fresh;
  }

  function issueRequest() {
    if (!resolution || resolution.status !== "ACTIVE") return;
    setError("");
    setCheck(null);
    setSessionNotice("");
    setSession(null);
    setSecurityResult(null);
    try {
      const issued = service().issue({
        expectedSubject: resolution.subject,
        expectedAddress: resolution.activeBch?.address ?? null,
      });
      setRequest(issued);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function signIn() {
    if (!request || !resolution) return;
    setError("");
    setCheck(null);
    setBusy(true);
    try {
      const stored = getIdentity(resolution.subject);
      let signer;
      if (stored?.nostrSecret) {
        signer = signerFromSecretKey(hexToBytes(stored.nostrSecret));
      } else {
        const provider = getNip07Provider();
        if (!provider) throw new Error("This browser holds no demo key for this identity, and no NIP-07 extension was detected.");
        signer = nip07Signer(provider);
      }
      // Re-resolve at authentication time. A cached resolution must never
      // authorize a session after a rotation, revocation or stale relay view.
      const fresh = await refreshIdentity(resolution.subject, relays, NETWORK);
      setResolution(fresh);
      const event = await buildAuthRequestEvent({
        request,
        signer,
        createdAt: Math.floor(Date.now() / 1000),
      });
      setLastEvent(event);
      const result = service().verify(event, fresh);
      setCheck({ code: result.check.code, message: result.check.message, ok: result.check.authenticated });
      if (result.check.authenticated && result.session) {
        setSession(result.session);
        setRequest(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function revalidate() {
    if (!session) return;
    setBusy(true);
    setSessionNotice("");
    try {
      const fresh = await refreshResolution();
      if (!fresh) return;
      const result = service().validate(session.token, fresh);
      if (!result.valid) {
        setSession(null);
        setSessionNotice(`${result.code}: ${result.message}`);
      } else {
        setSessionNotice(`Session revalidated at ${timestamp(Math.floor(Date.now() / 1000))}.`);
      }
    } finally {
      setBusy(false);
    }
  }

  function replay() {
    if (!lastEvent || !resolution) return;
    const result = service().verify(lastEvent, resolution);
    setCheck({ code: result.check.code, message: result.check.message, ok: result.check.authenticated });
  }

  function logout() {
    if (session) service().logout(session.token);
    setSession(null);
    setSessionNotice("Logged out. Session invalidated in the relying party.");
    setCheck(null);
  }

  async function revoke() {
    if (!subject || !resolution?.head || !resolution.activeBch) return;
    const stored = getIdentity(subject);
    if (!stored) return;
    setBusy(true);
    setError("");
    setSessionNotice("");
    try {
      const freshHead = await refreshIdentity(subject, relays, NETWORK);
      if (freshHead.status !== "ACTIVE" || freshHead.assurance !== "FULL" || !freshHead.head) {
        throw new Error(`Identity is not ACTIVE (${freshHead.status}); revocation aborted.`);
      }
      await revokeDemoIdentity(stored, freshHead.head.record, relays);
      setRequest(null);
      setLastEvent(null);
      const fresh = await refreshResolution();
      if (session && fresh) {
        const result = service().validate(session.token, fresh);
        setSession(null);
        setSessionNotice(`${result.code}: ${result.message}`);
      }
      setLocal(listIdentities());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!subject || !resolution?.head || !resolution.activeBch) return;
    const stored = getIdentity(subject);
    if (!stored) return;
    setBusy(true);
    setError("");
    setSessionNotice("");
    try {
      const freshHead = await refreshIdentity(subject, relays, NETWORK);
      if (freshHead.status !== "ACTIVE" || freshHead.assurance !== "FULL" || !freshHead.head) {
        throw new Error(`Identity is not ACTIVE (${freshHead.status}); rotation aborted.`);
      }
      const result = await rotateDemoIdentity(stored, freshHead.head.record, relays, NETWORK);
      setRequest(null);
      setLastEvent(null);
      const fresh = await refreshResolution();
      if (session && fresh) {
        const checkResult = service().validate(session.token, fresh);
        setSession(null);
        setSessionNotice(`${checkResult.code}: ${checkResult.message} New address ${result.newAddress}.`);
      }
      setLocal(listIdentities());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function runUnauthorizedRotationCheck() {
    setSecurityResult(null);
    try {
      const f = await getLabFixtures();
      const forged = f.forged;
      const result = resolveEvents([f.bind.event, forged.event], { now: LAB_NOW }).resolution;
      const rp = new AuthRequestService({
        origin: window.location.origin,
        domain: window.location.host,
        ttlSeconds: 120,
        sessionTtlSeconds: 900,
        now: () => LAB_NOW,
      });
      const req = rp.issue({
        expectedSubject: f.subject,
        expectedAddress: f.walletC.identity.address,
      });
      const event = await buildAuthRequestEvent({ request: req, signer: f.signer, createdAt: LAB_NOW });
      const auth = rp.verify(event, result);
      setSecurityResult({
        label: "Unauthorized rotation fixture",
        ok: !auth.check.authenticated && result.activeBch?.address === f.walletA.identity.address,
        detail: `${auth.check.code}: ${auth.check.message} · resolved address ${shortAddress(result.activeBch?.address)}`,
      });
    } catch (cause) {
      setSecurityResult({
        label: "Unauthorized rotation fixture",
        ok: false,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  const activeAddress = resolution?.activeBch?.address ?? null;
  const canSign = resolution?.status === "ACTIVE" && Boolean(request);
  const stored = subject ? local.find((candidate) => candidate.subject === subject) ?? null : null;
  const requestDigest = request ? authRequestDigest(request) : "";

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-10">
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ivory/[0.1] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7b07a] text-[13px] font-bold text-charcoal-950">
              S
            </div>
            <div>
              <div className="font-display text-[20px] leading-none text-ivory">Sawa Market</div>
              <div className="mt-1 text-[10px] text-ivory-muted">Relying-party demo · same origin</div>
            </div>
          </div>
          <div className="text-[10px] text-ivory-muted">{originHost || "this origin"}</div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[36px] leading-[1.03] tracking-editorial text-ivory sm:text-[48px]">
              Sign in with an identity,
              <br />
              not a password.
            </h1>
            <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-ivory-dim">
              A temporary challenge bound to this origin, session, identity and BCH address. The relying
              party verifies the chain itself.
            </p>
          </div>
          <Link href="/developers" className="text-[11px] text-signal transition-colors hover:text-signal-bright">
            Integration docs →
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <SectionLabel>01 · Identify the user</SectionLabel>
            {local.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {local.map((identity) => (
                  <button
                    key={identity.subject}
                    onClick={() => void resolve(identity.npub)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em]",
                      subject === identity.subject
                        ? "border-signal/60 bg-signal/[0.07] text-signal-bright"
                        : "border-ivory/18 text-ivory-muted hover:border-ivory/40",
                    )}
                  >
                    {identity.npub.slice(0, 10)}…
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void resolve();
                }}
                placeholder="npub1… or 64-char hex"
                spellCheck={false}
                className="font-mono text-[12px]"
              />
              <Button onClick={() => void resolve()} disabled={busy} className="shrink-0">
                {busy ? <Spinner /> : null} Resolve
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
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={resolution.status} />
                  <Badge tone={resolution.assurance === "FULL" ? "accent" : "warn"}>{resolution.assurance} sync</Badge>
                  <span className="font-mono text-[9px] text-ivory-muted">
                    {resolution.sync.responded}/{resolution.sync.total} relays
                  </span>
                </div>
                <div className="break-all font-mono text-[10px] text-ivory-dim">{toNpub(resolution.subject)}</div>
                <div className="rounded-lg border border-ivory/[0.1] bg-charcoal-950/40 p-3">
                  <div className="text-[10px] text-ivory-muted">Current BCH identity</div>
                  <div className="mt-1 break-all font-mono text-[11px] text-ivory">{activeAddress ?? "none asserted"}</div>
                  <div className="mt-1 font-mono text-[9px] text-ivory-muted">
                    sequence #{resolution.head?.record.payload.sequence ?? "—"} · checked {timestamp(resolution.checkedAt)}
                  </div>
                </div>
                {resolution.status !== "ACTIVE" ? (
                  <Alert tone="danger" title="Sign-in unavailable">
                    {resolution.reason}
                  </Alert>
                ) : (
                  <Button onClick={issueRequest} disabled={Boolean(request)}>
                    Create sign-in request
                  </Button>
                )}
              </div>
            ) : null}
          </Card>

          {request ? (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <SectionLabel>02 · Challenge</SectionLabel>
                <Badge tone="warn">expires {timestamp(request.expiresAt)}</Badge>
              </div>
              <div className="grid gap-2 text-[10.5px] sm:grid-cols-2">
                <Fact label="Origin" value={request.origin} />
                <Fact label="Session" value={shortHex(request.sessionId, 12, 8)} />
                <Fact label="Intended subject" value={shortHex(request.expectedSubject ?? "", 12, 8)} />
                <Fact label="Expected BCH" value={shortAddress(request.expectedAddress)} />
                <Fact label="Challenge" value={shortHex(request.challenge, 12, 8)} />
                <Fact label="Protocol" value={request.protocol} />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] text-ivory-muted">Request digest</span>
                  <CopyButton value={requestDigest || request.challenge} label="Copy challenge" />
                </div>
                <div className="break-all rounded-lg border border-ivory/[0.1] bg-charcoal-950/40 p-3 font-mono text-[9px] text-ivory-muted">
                  {request.challenge}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={() => void signIn()} disabled={!canSign || busy}>
                  {busy ? <Spinner /> : null} Sign with {stored?.nostrSecret ? "this browser" : "NIP-07"}
                </Button>
                <Button variant="ghost" onClick={() => setRequest(null)}>
                  Cancel
                </Button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-ivory-muted">
                The event signs the challenge and the full request. A challenge is consumed on first
                successful use.
              </p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <GlassPanel strong className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Session</SectionLabel>
              <Badge tone={session ? "accent" : "neutral"}>{session ? "authenticated" : "signed out"}</Badge>
            </div>
            {session ? (
              <div className="animate-rise">
                <div className="font-display text-[26px] leading-tight text-ivory">Welcome back.</div>
                <div className="mt-1 text-[11.5px] text-ivory-dim">
                  Session issued only after signature and chain verification.
                </div>
                <div className="mt-4 space-y-2">
                  <Fact label="Subject" value={shortHex(session.subject, 18, 10)} />
                  <Fact label="BCH identity" value={session.bchAddress} />
                  <Fact label="Issued" value={timestamp(session.issuedAt)} />
                  <Fact label="Expires" value={timestamp(session.expiresAt)} />
                  <Fact label="Token" value={shortHex(session.token, 28, 12)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void revalidate()} disabled={busy}>
                    {busy ? <Spinner /> : null} Revalidate session
                  </Button>
                  <Button variant="ghost" onClick={logout}>
                    Log out
                  </Button>
                </div>
                {sessionNotice ? (
                  <div className="mt-3">
                    <Alert tone={sessionNotice.includes("SESSION_") ? "danger" : "success"}>{sessionNotice}</Alert>
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <div className="font-display text-[26px] leading-tight text-ivory">Not signed in.</div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ivory-dim">
                  A short-lived local session. Rotation or revocation invalidates it on revalidation.
                </p>
                {sessionNotice ? (
                  <div className="mt-3">
                    <Alert tone="warn">{sessionNotice}</Alert>
                  </div>
                ) : null}
              </div>
            )}
          </GlassPanel>

          {check ? (
            <Card className={cn("p-5", check.ok ? "border-accent/40" : "border-danger/40")}>
              <SectionLabel>Last verification</SectionLabel>
              <div className="flex items-center gap-2">
                <Badge tone={check.ok ? "accent" : "danger"}>{check.ok ? "accepted" : "rejected"}</Badge>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ivory-muted">{check.code}</span>
              </div>
              <p className="mt-2 text-[11.5px] text-ivory-dim">{check.message}</p>
            </Card>
          ) : null}

          <Card className="p-5">
            <SectionLabel>03 · Negative checks</SectionLabel>
            <p className="text-[11px] leading-relaxed text-ivory-muted">
              Real verifier functions. Deterministic fixtures.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={replay} disabled={!lastEvent || !resolution}>
                Replay last challenge
              </Button>
              <Button variant="secondary" onClick={() => void runUnauthorizedRotationCheck()}>
                Unauthorized rotation
              </Button>
            </div>
            {securityResult ? (
              <div className="mt-3">
                <Alert tone={securityResult.ok ? "success" : "danger"} title={securityResult.label}>
                  {securityResult.detail}
                </Alert>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => void revoke()} disabled={!stored || busy}>
                Revoke identity
              </Button>
              <Button variant="secondary" onClick={() => void rotate()} disabled={!stored || busy}>
                Rotate wallet
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ivory-muted">
              Revoke and rotate require a browser-local demo identity. They publish real signed records.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-ivory/[0.06] pb-1.5 last:border-0">
      <div className="text-[10px] text-ivory-muted">{label}</div>
      <div className="mt-0.5 break-all font-mono text-[9.5px] text-ivory-dim">{value || "—"}</div>
    </div>
  );
}
