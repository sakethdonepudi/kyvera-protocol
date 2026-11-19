"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { hexToBytes } from "@kyvera/bch";
import { normalizeNostrPublicKey, signerFromSecretKey, type NostrSigner } from "@kyvera/nostr";
import type { IdentityResolution } from "@kyvera/verifier";
import { DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { refreshIdentity, rotateDemoIdentity } from "@/lib/identity";
import { getNip07Provider, nip07Signer } from "@/lib/nip07";
import { getIdentity, listIdentities, type StoredIdentity } from "@/lib/store";
import {
  CHALLENGE_STAGES,
  getChallengeDemo,
  proveSuperseded,
  runChallengeAuth,
  type ChallengeDemo,
  type ChallengeResult,
  type ChallengeStage,
} from "@/lib/challenge";
import { shortAddress, shortHex, timestamp } from "@/lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  GlassPanel,
  SectionLabel,
  Spinner,
  StatusBadge,
  cn,
} from "@/components/ui";

type Mode = "demo" | "live";

const STAGE_COPY: Record<ChallengeStage, string> = {
  Bind: "Wallet A and the Nostr key sign the genesis record.",
  Verify: "Verify both signatures and the authorization chain.",
  Authenticate: "A relying party issues a single-use challenge.",
  Rotate: "Wallet A authorizes wallet B.",
  Prove: "Wallet A's proof stays valid. Its authorization does not.",
};

export default function ChallengePage() {
  const [mode, setMode] = useState<Mode>("demo");
  const [stage, setStage] = useState(0);
  const [demo, setDemo] = useState<ChallengeDemo | null>(null);
  const [demoError, setDemoError] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);

  const [local, setLocal] = useState<StoredIdentity[]>([]);
  const [liveSubject, setLiveSubject] = useState("");
  const [live, setLive] = useState<IdentityResolution | null>(null);
  const [liveError, setLiveError] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveResults, setLiveResults] = useState<Partial<Record<ChallengeStage, ChallengeResult>>>({});
  const [liveOldAddress, setLiveOldAddress] = useState("");

  const current = CHALLENGE_STAGES[stage]!;

  async function loadDemo() {
    setDemoBusy(true);
    setDemoError("");
    try {
      setDemo(await getChallengeDemo());
    } catch (cause) {
      setDemoError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDemoBusy(false);
    }
  }

  useEffect(() => {
    void loadDemo();
    setLocal(listIdentities());
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setStage(0);
  }

  async function resolveLive(subject = liveSubject) {
    if (!subject) return;
    setLiveBusy(true);
    setLiveError("");
    setLiveResults({});
    setLiveOldAddress("");
    try {
      const normalized = normalizeNostrPublicKey(subject.trim());
      if (!normalized) throw new Error("Enter a valid npub or 32-byte hex public key.");
      const resolution = await refreshIdentity(normalized, DEFAULT_RELAYS, NETWORK);
      setLive(resolution);
      setLiveSubject(resolution.subject);
      const head = resolution.head?.record.payload;
      const bind: ChallengeResult = {
        pass:
          resolution.status === "ACTIVE" &&
          Boolean(resolution.activeBch) &&
          resolution.history.length > 0,
        headline:
          resolution.status === "ACTIVE"
            ? "Identity resolved from its signed genesis record."
            : `Identity is not active: ${resolution.status}.`,
        checks: [
          {
            label: "Authorization chain is ACTIVE",
            ok: resolution.status === "ACTIVE",
            detail: `${resolution.status} · ${resolution.reasonCode}`,
          },
          {
            label: "Genesis binding present",
            ok: resolution.history.length > 0,
            detail: `${resolution.history.length} valid record(s)`,
          },
          {
            label: "Current BCH address asserted",
            ok: Boolean(resolution.activeBch),
            detail: resolution.activeBch?.address ?? "none",
          },
          {
            label: "Latest sequence",
            ok: typeof head?.sequence === "number",
            detail: head ? `#${head.sequence} · ${head.type}` : "no head",
          },
        ],
        evidence: {
          subject: resolution.subject,
          head: resolution.head?.recordId,
          activeBch: resolution.activeBch,
          reason: resolution.reason,
        },
      };
      const verify: ChallengeResult = {
        pass: resolution.assurance === "FULL" && resolution.history.length > 0,
        headline:
          resolution.assurance === "UNSYNCED"
            ? "No relay could confirm the current state."
            : resolution.assurance === "PARTIAL"
              ? "The chain is valid, but current authorization is not final without full relay agreement."
              : "Resolver reports a complete chain for the observed relays.",
        checks: [
          {
            label: "Full relay agreement",
            ok: resolution.assurance === "FULL",
            detail: resolution.assurance,
          },
          {
            label: "Relay responses observed",
            ok: resolution.sync.responded > 0,
            detail: `${resolution.sync.responded}/${resolution.sync.total} relays`,
          },
          {
            label: "No conflict reported",
            ok: resolution.conflict === null,
            detail: resolution.conflict ? `sequence #${resolution.conflict.sequence}` : "none",
          },
          {
            label: "History is not empty",
            ok: resolution.history.length > 0,
            detail: `${resolution.history.length} record(s)`,
          },
        ],
        evidence: {
          assurance: resolution.assurance,
          sync: resolution.sync,
          conflict: resolution.conflict,
          rejected: resolution.rejected,
        },
      };
      setLiveResults({ Bind: bind, Verify: verify });
    } catch (cause) {
      setLiveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLiveBusy(false);
    }
  }

  async function authenticateLive() {
    if (!live) return;
    setLiveBusy(true);
    setLiveError("");
    try {
      const stored = getIdentity(live.subject);
      let signer: NostrSigner;
      if (stored?.nostrSecret) {
        signer = signerFromSecretKey(hexToBytes(stored.nostrSecret));
      } else {
        const provider = getNip07Provider();
        if (!provider) {
          throw new Error("No local demo key or NIP-07 signer is available for this identity.");
        }
        signer = nip07Signer(provider);
      }
      // Re-resolve at authentication time so a cached ACTIVE state cannot
      // issue a session after rotation or revocation.
      const fresh = await refreshIdentity(live.subject, DEFAULT_RELAYS, NETWORK);
      setLive(fresh);
      const result = await runChallengeAuth({
        resolution: fresh,
        signer,
        origin: window.location.origin,
        domain: window.location.host,
      });
      const pass =
        result.check.authenticated === true &&
        Boolean(result.session) &&
        result.replay.code === "UNKNOWN_CHALLENGE";
      setLiveResults((previous) => ({
        ...previous,
        Authenticate: {
          pass,
          headline: pass
            ? "A relying-party session was issued from a single-use challenge."
            : "Authentication did not complete.",
          checks: [
            {
              label: "Challenge signature authenticates",
              ok: result.check.authenticated === true,
              detail: `${result.check.code} · ${result.check.message}`,
            },
            {
              label: "Session issued only after verification",
              ok: Boolean(result.session),
              detail: result.session
                ? `expires ${timestamp(result.session.expiresAt)}`
                : "no session",
            },
            {
              label: "Replay is rejected",
              ok: result.replay.code === "UNKNOWN_CHALLENGE",
              detail: `${result.replay.code} · ${result.replay.message}`,
            },
            {
              label: "Session is short-lived",
              ok: Boolean(result.session && result.session.expiresAt - result.session.issuedAt <= 900),
              detail: result.session
                ? `${result.session.expiresAt - result.session.issuedAt}s`
                : "n/a",
            },
          ],
          evidence: {
            origin: result.request.origin,
            sessionId: result.request.sessionId,
            challenge: result.request.challenge,
            token: result.session?.token,
            requestDigest: result.session?.requestDigest,
          },
        },
      }));
    } catch (cause) {
      setLiveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLiveBusy(false);
    }
  }

  async function rotateLive() {
    if (!live?.head || !live.activeBch) return;
    const stored = getIdentity(live.subject);
    if (!stored) {
      setLiveError("This identity is not stored in this browser, so it cannot publish a rotation.");
      return;
    }
    setLiveBusy(true);
    setLiveError("");
    const previousAddress = live.activeBch.address;
    try {
      // A stale head would publish a competing sequence record. Re-resolve
      // immediately before signing the rotation.
      const before = await refreshIdentity(live.subject, DEFAULT_RELAYS, NETWORK);
      if (before.status !== "ACTIVE" || before.assurance !== "FULL" || !before.head) {
        throw new Error(`Identity is not ACTIVE (${before.status}); rotation aborted.`);
      }
      setLive(before);
      const result = await rotateDemoIdentity(stored, before.head.record, DEFAULT_RELAYS, NETWORK);
      const fresh = await refreshIdentity(live.subject, DEFAULT_RELAYS, NETWORK);
      setLive(fresh);
      setLiveOldAddress(previousAddress);
      const superseded = fresh.superseded.some((entry) => entry.address === previousAddress);
      const pass =
        fresh.status === "ACTIVE" &&
        fresh.activeBch?.address === result.newAddress &&
        superseded;
      setLiveResults((previous) => ({
        ...previous,
        Rotate: {
          pass,
          headline: pass
            ? "Authorized rotation published. Wallet B is current."
            : "Rotation published but the new state did not verify as expected.",
          checks: [
            {
              label: "New address is current",
              ok: fresh.activeBch?.address === result.newAddress,
              detail: result.newAddress,
            },
            {
              label: "Old address is superseded",
              ok: superseded,
              detail: previousAddress,
            },
            {
              label: "Chain remains ACTIVE",
              ok: fresh.status === "ACTIVE",
              detail: `${fresh.status} · ${fresh.reasonCode}`,
            },
            {
              label: "Rotation event accepted by relays",
              ok: Boolean(result.event.id),
              detail: shortHex(result.event.id, 14, 10),
            },
          ],
          evidence: {
            eventId: result.event.id,
            newAddress: result.newAddress,
            oldAddress: previousAddress,
          },
        },
      }));
    } catch (cause) {
      setLiveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLiveBusy(false);
    }
  }

  function proveLive() {
    if (!live) return;
    const oldAddress =
      liveOldAddress || live.superseded[live.superseded.length - 1]?.address || "";
    if (!oldAddress) {
      setLiveResults((previous) => ({
        ...previous,
        Prove: {
          pass: false,
          headline: "Rotate the wallet first to create a historical authorization.",
          checks: [
            {
              label: "A superseded address exists",
              ok: false,
              detail: "no historical wallet in this chain",
            },
          ],
        },
      }));
      return;
    }
    const historical = live.history.find((step) => step.record.payload.bch?.address === oldAddress)?.event;
    setLiveResults((previous) => ({
      ...previous,
      Prove: proveSuperseded(live, oldAddress, historical),
    }));
  }

  const demoResult = mode === "demo" ? demo?.results[current] : undefined;
  const liveResult = mode === "live" ? liveResults[current] : undefined;
  const result = mode === "demo" ? demoResult : liveResult;
  const busy = mode === "demo" ? demoBusy : liveBusy;

  const stageStatus = useMemo(() => {
    return CHALLENGE_STAGES.map((item) => {
      if (mode === "demo") return demo?.results[item]?.pass;
      return liveResults[item]?.pass;
    });
  }, [mode, demo, liveResults]);

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-10">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <h1 className="font-display text-[38px] leading-[1.04] tracking-editorial text-ivory sm:text-[50px]">
            Five stages.
            <br />
            One verifiable identity.
          </h1>
          <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-ivory-dim">
            Bind, verify, authenticate, rotate, prove.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["demo", "live"] as const).map((value) => (
            <button
              key={value}
              onClick={() => switchMode(value)}
              aria-pressed={mode === value}
              className={cn(
                "rounded-full border px-3.5 py-2 text-[11px] transition-colors duration-200",
                mode === value
                  ? "border-signal bg-signal text-charcoal-950"
                  : "border-ivory/15 text-ivory-muted hover:border-ivory/35 hover:text-ivory",
              )}
            >
              {value === "demo" ? "Guided demo" : "Live identity"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[270px_1fr]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-ivory/[0.1] p-4">
              <SectionLabel>Stages</SectionLabel>
              <ol className="space-y-1">
                {CHALLENGE_STAGES.map((item, index) => {
                  const pass = stageStatus[index];
                  return (
                    <li key={item}>
                      <button
                        onClick={() => setStage(index)}
                        aria-current={stage === index ? "step" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg border-l px-2.5 py-2 text-left transition-colors",
                          stage === index
                            ? "border-signal bg-signal/[0.05]"
                            : "border-ivory/10 hover:border-ivory/30 hover:bg-ivory/[0.03]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[8px]",
                            pass === true
                              ? "border-accent/45 bg-accent/15 text-accent-bright"
                              : pass === false
                                ? "border-danger/45 bg-danger/10 text-danger"
                                : "border-ivory/20 text-ivory-muted",
                          )}
                        >
                          {pass === true ? "✓" : pass === false ? "!" : index + 1}
                        </span>
                        <span className={cn("text-[11.5px]", stage === index ? "text-ivory" : "text-ivory-muted")}>
                          {item}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="px-4 py-3 text-[10.5px] text-ivory-muted">
              {mode === "demo"
                ? "Deterministic fixtures · unspendable keys"
                : "Stored identity · real relays"}
            </div>
          </Card>

          {mode === "demo" ? (
            <Card className="p-4">
              <SectionLabel>Fixture</SectionLabel>
              {demo ? (
                <div className="mt-2 space-y-1.5 font-mono text-[9.5px] text-ivory-muted">
                  <div className="break-all">{demo.fixtures.npub}</div>
                  <div>wall A · {shortAddress(demo.fixtures.walletA.identity.address)}</div>
                  <div>wall B · {shortAddress(demo.fixtures.walletB.identity.address)}</div>
                  <div>fixture clock {timestamp(demo.bind.checkedAt)}</div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-ivory-dim">
                  <Spinner /> Building fixtures…
                </div>
              )}
              <Button
                variant="ghost"
                className="mt-3 px-0 text-[10px]"
                onClick={() => void loadDemo()}
                disabled={demoBusy}
              >
                {demoBusy ? "Re-running…" : "Re-run challenge"}
              </Button>
            </Card>
          ) : (
            <Card className="p-4">
              <SectionLabel>Live identity</SectionLabel>
              {local.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {local.map((identity) => (
                    <button
                      key={identity.subject}
                      onClick={() => void resolveLive(identity.npub)}
                      className={cn(
                        "rounded-full border px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.08em]",
                        liveSubject === identity.subject
                          ? "border-signal/60 bg-signal/[0.07] text-signal-bright"
                          : "border-ivory/15 text-ivory-muted hover:border-ivory/35",
                      )}
                    >
                      {identity.npub.slice(0, 10)}…
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-ivory-muted">
                  No browser-local identity yet.
                </p>
              )}
              <Link
                href="/create"
                className="mt-3 inline-block text-[11px] text-signal transition-colors hover:text-signal-bright"
              >
                Create identity →
              </Link>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <GlassPanel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[10.5px] text-ivory-muted">
                Stage {stage + 1} / {CHALLENGE_STAGES.length}
              </div>
              {mode === "live" && live ? (
                <>
                  <StatusBadge status={live.status} />
                  {live.assurance !== "FULL" ? (
                    <Badge tone="warn">{live.assurance} · not final</Badge>
                  ) : null}
                </>
              ) : null}
              {result ? (
                <Badge tone={result.pass ? "accent" : "danger"}>{result.pass ? "PASS" : "FAIL"}</Badge>
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-[30px] leading-tight tracking-editorial text-ivory">
              {current}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ivory-dim">
              {STAGE_COPY[current]}
            </p>

            <div className="mt-5">
              {mode === "demo" ? (
                busy ? (
                  <div className="flex items-center gap-2 text-[12px] text-ivory-dim">
                    <Spinner /> Running verifier…
                  </div>
                ) : demoError ? (
                  <Alert tone="danger">{demoError}</Alert>
                ) : result ? (
                  <ResultPanel result={result} />
                ) : (
                  <div className="flex items-center gap-2 text-[12px] text-ivory-dim">
                    <Spinner /> Loading…
                  </div>
                )
              ) : (
                <LiveStage
                  stage={current}
                  live={live}
                  result={liveResult}
                  busy={liveBusy}
                  error={liveError}
                  onResolve={() => void resolveLive()}
                  onAuthenticate={() => void authenticateLive()}
                  onRotate={() => void rotateLive()}
                  onProve={proveLive}
                  canResolve={Boolean(liveSubject)}
                  canRotate={
                    Boolean(live) &&
                    Boolean(getIdentity(live?.subject ?? "")?.bchKeys.length) &&
                    Boolean(getIdentity(live?.subject ?? "")?.nostrSecret)
                  }
                />
              )}
            </div>
          </GlassPanel>

          {mode === "live" && live ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionLabel>Resolved identity</SectionLabel>
                <Badge tone={live.assurance === "FULL" ? "accent" : "warn"}>{live.assurance} sync</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Fact label="Subject" value={shortHex(live.subject, 18, 10)} />
                <Fact label="Current BCH" value={live.activeBch?.address ?? "none"} />
                <Fact label="Head sequence" value={`#${live.head?.record.payload.sequence ?? "—"}`} />
                <Fact label="Relays" value={`${live.sync.responded}/${live.sync.total}`} />
                <Fact label="Reason" value={`${live.reasonCode} · ${live.reason}`} />
                <Fact label="Checked" value={timestamp(live.checkedAt)} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LiveStage({
  stage,
  live,
  result,
  busy,
  error,
  onResolve,
  onAuthenticate,
  onRotate,
  onProve,
  canResolve,
  canRotate,
}: {
  stage: ChallengeStage;
  live: IdentityResolution | null;
  result: ChallengeResult | undefined;
  busy: boolean;
  error: string;
  onResolve: () => void;
  onAuthenticate: () => void;
  onRotate: () => void;
  onProve: () => void;
  canResolve: boolean;
  canRotate: boolean;
}) {
  if (!live && stage !== "Bind") {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-ivory-muted">Resolve a browser-local identity first.</p>
        <Button onClick={onResolve} disabled={busy || !canResolve}>
          Resolve identity
        </Button>
        {!canResolve ? (
          <p className="text-[10.5px] text-ivory-muted">Select an identity on the left first.</p>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {stage === "Bind" ? (
          <Button onClick={onResolve} disabled={busy || !canResolve}>
            {busy ? <Spinner /> : null} {live ? "Re-resolve" : "Resolve identity"}
          </Button>
        ) : null}
        {stage === "Verify" ? (
          <Button onClick={onResolve} disabled={busy || !canResolve}>
            {busy ? <Spinner /> : null} Re-verify from relays
          </Button>
        ) : null}
        {stage === "Authenticate" ? (
          <Button onClick={onAuthenticate} disabled={busy}>
            {busy ? <Spinner /> : null} Sign in with this identity
          </Button>
        ) : null}
        {stage === "Rotate" ? (
          <Button onClick={onRotate} disabled={busy || !canRotate}>
            {busy ? <Spinner /> : null} Rotate demo wallet
          </Button>
        ) : null}
        {stage === "Prove" ? (
          <Button onClick={onProve} disabled={busy}>
            Prove old wallet is superseded
          </Button>
        ) : null}
      </div>
      {stage === "Rotate" ? (
        <p className="text-[10.5px] leading-relaxed text-ivory-muted">
          {canRotate
            ? "Publishes one signed rotation to the configured relays. Demo keys only."
            : "Rotation needs the current BCH key and Nostr key in this browser. External wallets must rotate from the identity dashboard."}
        </p>
      ) : null}
      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

function ResultPanel({ result }: { result: ChallengeResult }) {
  return (
    <div className="space-y-3">
      <div className="text-[12px] font-medium text-ivory">{result.headline}</div>
      <ul className="space-y-2">
        {result.checks.map((check) => (
          <li key={check.label} className="flex flex-col gap-0.5 text-[11px] sm:flex-row sm:items-start sm:gap-2">
            <span className="flex items-start gap-2">
              <span className={check.ok ? "text-accent-bright" : "text-danger"}>
                {check.ok ? "✓" : "✕"}
              </span>
              <span className={check.ok ? "text-ivory-dim" : "text-ivory"}>{check.label}</span>
            </span>
            <span className="break-all pl-5 font-mono text-[9px] text-ivory-muted sm:ml-auto sm:max-w-[48%] sm:pl-0 sm:text-right">
              {check.detail}
            </span>
          </li>
        ))}
      </ul>
      {result.evidence ? (
        <details className="rounded-lg border border-ivory/[0.08] bg-charcoal-950/40 p-3">
          <summary className="cursor-pointer text-[10px] text-ivory-muted transition-colors hover:text-ivory-dim">
            Evidence
          </summary>
          <div className="mt-2 flex items-start gap-2">
            <pre className="scroll-pane max-h-56 flex-1 overflow-auto whitespace-pre-wrap break-all font-mono text-[9px] leading-relaxed text-ivory-muted">
{JSON.stringify(result.evidence, null, 2)}
            </pre>
            <CopyButton value={JSON.stringify(result.evidence, null, 2)} label="Copy" />
          </div>
        </details>
      ) : null}
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
