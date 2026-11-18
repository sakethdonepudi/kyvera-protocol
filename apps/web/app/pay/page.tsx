"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";

import { normalizeNostrPublicKey, toNpub } from "@kyvera/nostr";
import type { IdentityResolution } from "@kyvera/verifier";
import { useWizardConnect, WizardConnectQRDialog } from "@wizardconnect/react";
import { DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { deriveWalletAddress } from "@/lib/wallet";
import { refreshIdentity } from "@/lib/identity";
import {
  buildBip21Uri,
  checkPayable,
  destinationChanged,
  parseBchAmount,
  type DestinationSnapshot,
} from "@/lib/pay";
import { shortAddress, timestamp } from "@/lib/format";
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

type Phase = "idle" | "resolving" | "verified" | "ready";

export default function PayPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-5 py-16 text-ivory-muted">Loading pay…</div>}>
      <PayInner />
    </Suspense>
  );
}

function PayInner() {
  const search = useSearchParams();
  const [input, setInput] = useState(search.get("npub") ?? "");
  const [subject, setSubject] = useState<string | null>(null);
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [resolution, setResolution] = useState<IdentityResolution | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [changeWarning, setChangeWarning] = useState("");
  const [snapshot, setSnapshot] = useState<DestinationSnapshot | null>(null);

  const wallet = useWizardConnect({
    dappName: "KYVERA Pay",
    sessionKey: "kyvera-wizardconnect",
  });

  useEffect(() => {
    if (search.get("npub")) void resolve(input);
    // Deep link only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountCheck = useMemo(() => parseBchAmount(amount), [amount]);
  const payCheck = useMemo(
    () => (resolution ? checkPayable(resolution, NETWORK) : null),
    [resolution],
  );
  const uri = useMemo(
    () =>
      resolution?.activeBch && amountCheck.ok
        ? buildBip21Uri({
            address: resolution.activeBch.address,
            amountBch: amountCheck.bch || undefined,
            label,
            message,
          })
        : "",
    [resolution, amountCheck, label, message],
  );

  useEffect(() => {
    if (!uri) {
      setQr(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(uri, {
      margin: 1,
      width: 360,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a08", light: "#f6f5f1" },
    })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const walletAddress = useMemo(
    () => (wallet.state === "connected" ? deriveWalletAddress(wallet.manager, NETWORK) : null),
    [wallet.state, wallet.manager],
  );

  async function resolve(target = input) {
    setError("");
    setChangeWarning("");
    setHandoff(false);
    setConfirmed(false);
    setResolution(null);
    setSnapshot(null);
    setPhase("resolving");
    try {
      const normalized = normalizeNostrPublicKey(target.trim());
      if (!normalized) throw new Error("Enter a valid npub or 32-byte hex public key.");
      setSubject(normalized);
      const result = await refreshIdentity(normalized, relays, NETWORK);
      setResolution(result);
      setSnapshot(
        result.activeBch
          ? { subject: result.subject, address: result.activeBch.address, status: result.status }
          : null,
      );
      setPhase(result.status === "ACTIVE" ? "verified" : "idle");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase("idle");
    }
  }

  async function prepareHandoff() {
    if (!subject || !resolution?.activeBch) return;
    setError("");
    setChangeWarning("");
    setPhase("resolving");
    try {
      // Re-resolve immediately before showing the wallet handoff.
      const fresh = await refreshIdentity(subject, relays, NETWORK);
      setResolution(fresh);
      const nextSnapshot = fresh.activeBch
        ? { subject: fresh.subject, address: fresh.activeBch.address, status: fresh.status }
        : null;
      if (destinationChanged(snapshot, nextSnapshot)) {
        setSnapshot(nextSnapshot);
        setHandoff(false);
        setConfirmed(false);
        setPhase(fresh.status === "ACTIVE" ? "verified" : "idle");
        setChangeWarning(
          "The destination changed or is no longer ACTIVE. The previous payment intent was cancelled. Review the new destination before continuing.",
        );
        return;
      }
      setPhase("verified");
      setHandoff(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase("verified");
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-12">
      <div className="max-w-3xl">
        <div className="kicker text-signal">KYVERA Pay</div>
        <h1 className="mt-3 font-display text-[40px] leading-[1.02] tracking-editorial text-ivory sm:text-[54px]">
          Pay the person.
          <br />
          Verify the destination.
        </h1>
        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-ivory-dim">
          Resolve a Nostr identity, verify its current BCH authorization chain, and hand a BIP21
          payment to a wallet you control. KYVERA never sees a key and never fabricates a receipt.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={NETWORK === "mainnet" ? "warn" : "neutral"}>{NETWORK}</Badge>
          <Badge tone="neutral">wallet handoff</Badge>
          <Badge tone="neutral">no custody</Badge>
        </div>
      </div>

      <div className="mt-9 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <SectionLabel>01 · Recipient identity</SectionLabel>
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
              <Button onClick={() => void resolve()} disabled={phase === "resolving"} className="shrink-0">
                {phase === "resolving" ? <Spinner /> : null} Resolve
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
            {changeWarning ? (
              <div className="mt-3">
                <Alert tone="warn" title="Destination changed — payment cancelled">
                  {changeWarning}
                </Alert>
              </div>
            ) : null}

            {resolution ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={resolution.status} />
                  <Badge tone={resolution.assurance === "FULL" ? "accent" : "warn"}>
                    {resolution.assurance} sync
                  </Badge>
                  <span className="font-mono text-[9px] text-ivory-muted">
                    {resolution.sync.responded}/{resolution.sync.total} relays
                  </span>
                </div>
                <div className="break-all font-mono text-[11px] text-ivory-dim">{toNpub(resolution.subject)}</div>
                <div className="rounded-lg border border-ivory/[0.1] bg-charcoal-950/40 p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                    current payment address
                  </div>
                  <div className="mt-1 break-all font-mono text-[12px] text-ivory">
                    {resolution.activeBch?.address ?? "none asserted"}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] text-ivory-muted">
                      sequence #{resolution.head?.record.payload.sequence ?? "—"} · checked{" "}
                      {timestamp(resolution.checkedAt)}
                    </span>
                    {resolution.activeBch ? <CopyButton value={resolution.activeBch.address} /> : null}
                    <Link
                      href={`/identity/${encodeURIComponent(toNpub(resolution.subject))}/time-machine`}
                      className="font-mono text-[9px] uppercase tracking-[0.1em] text-signal hover:text-signal-bright"
                    >
                      Inspect chain →
                    </Link>
                  </div>
                </div>
                {payCheck && !payCheck.ok ? (
                  <Alert tone="danger" title="Payment blocked">
                    {payCheck.message}
                  </Alert>
                ) : payCheck?.warning ? (
                  <Alert tone="warn">{payCheck.warning}</Alert>
                ) : (
                  <Alert tone="success">Destination is currently authorized by the verified chain.</Alert>
                )}
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <SectionLabel>02 · Amount and reference</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                  Amount (BCH)
                </label>
                <Input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.001 — leave blank for open amount"
                  inputMode="decimal"
                  className="font-mono text-[12px]"
                />
                {!amountCheck.ok ? (
                  <p className="mt-1 text-[10px] text-danger">{amountCheck.message}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                  Label
                </label>
                <Input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Optional recipient label"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                Message
              </label>
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Optional payment reference"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-start gap-2 text-[11px] leading-relaxed text-ivory-dim">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[rgb(var(--signal))]"
                />
                I verified the recipient and understand my wallet will broadcast the payment.
              </label>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => void prepareHandoff()}
              disabled={!payCheck?.ok || !amountCheck.ok || !confirmed || phase === "resolving"}
            >
              {phase === "resolving" ? <Spinner /> : null} Re-verify and prepare payment
            </Button>
            <p className="mt-2 text-[10px] leading-relaxed text-ivory-muted">
              The identity is re-resolved immediately before handoff. If the address changes, the intent
              is cancelled and must be reviewed again.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <GlassPanel strong className="p-5" id="wallet">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>03 · Wallet</SectionLabel>
              <Badge tone={wallet.state === "connected" ? "accent" : "neutral"}>{wallet.state}</Badge>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ivory-dim">
              Connect Paytaca, Selene or Cashonize through WizardConnect. The connection is used to
              verify the wallet network and address; the payment itself is handed to the wallet as BIP21.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => wallet.connect()}
                disabled={wallet.state === "connecting" || wallet.state === "connected"}
              >
                {wallet.state === "connecting" ? <Spinner /> : null} Connect wallet
              </Button>
              <Button
                variant="ghost"
                onClick={() => void wallet.disconnect()}
                disabled={wallet.state === "idle" || wallet.state === "disconnected"}
              >
                Disconnect
              </Button>
            </div>
            {wallet.walletName ? (
              <div className="mt-3 font-mono text-[10px] text-ivory-muted">wallet · {wallet.walletName}</div>
            ) : null}
            {walletAddress ? (
              <div className="mt-2 break-all rounded-lg border border-ivory/[0.1] bg-charcoal-950/40 p-3 font-mono text-[10px] text-ivory-dim">
                {walletAddress}
              </div>
            ) : null}
            {wallet.error ? (
              <div className="mt-3">
                <Alert tone="danger">{wallet.error}</Alert>
              </div>
            ) : null}
            {wallet.uri && wallet.qrUri ? (
              <WizardConnectQRDialog
                show={wallet.state === "connecting"}
                onClose={() => void wallet.disconnect()}
                uri={wallet.uri}
                qrUri={wallet.qrUri}
                title="KYVERA Pay"
                subtitle="Scan with Paytaca, Selene or Cashonize"
              />
            ) : null}
            <p className="mt-3 text-[10px] leading-relaxed text-ivory-muted">
              No seed phrase or private key is ever requested. The wallet may refuse the connection or
              handoff; those states are shown explicitly.
            </p>
          </GlassPanel>

          <GlassPanel className="p-5">
            <SectionLabel>04 · Verified handoff</SectionLabel>
            {!handoff || !uri ? (
              <p className="text-[11.5px] leading-relaxed text-ivory-muted">
                Complete the recipient check, amount and confirmation, then re-verify to create a payment
                handoff.
              </p>
            ) : (
              <div className="animate-rise">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">verified destination</Badge>
                  <span className="font-mono text-[9px] text-ivory-muted">BIP21</span>
                </div>
                <div className="mt-3 break-all font-mono text-[12px] text-ivory">
                  {shortAddress(resolution?.activeBch?.address)}
                </div>
                <div className="mt-1 font-mono text-[9px] text-ivory-muted">
                  {amountCheck.bch ? `${amountCheck.bch} BCH` : "open amount"} · {NETWORK}
                </div>
                {qr ? (
                  <div className="mt-4 flex justify-center rounded-xl bg-[#f6f5f1] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="BIP21 payment QR code" width={280} height={280} />
                  </div>
                ) : null}
                <div className="mt-3 rounded-lg border border-ivory/[0.1] bg-charcoal-950/40 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                      BIP21 URI
                    </span>
                    <CopyButton value={uri} />
                  </div>
                  <code className="break-all font-mono text-[9.5px] leading-relaxed text-ivory-dim">{uri}</code>
                </div>
                <a
                  href={uri}
                  className="mt-3 block rounded-[2px] bg-signal px-4 py-2.5 text-center text-[13px] font-semibold text-charcoal-950 hover:bg-signal-bright"
                >
                  Open in BCH wallet
                </a>
                <p className="mt-3 text-[10px] leading-relaxed text-ivory-muted">
                  Wallet handoff: your wallet broadcasts the transaction. KYVERA does not receive the
                  transaction id in this flow and will not display a fabricated receipt. For a verified
                  receipt, use a wallet/indexer integration that returns the txid.
                </p>
              </div>
            )}
          </GlassPanel>

          <Card className="p-5">
            <SectionLabel>Payment safety</SectionLabel>
            <ul className="space-y-2 text-[11px] leading-relaxed text-ivory-dim">
              <li>◆ Only an ACTIVE, currently authorized address can be paid.</li>
              <li>◆ Revoked, conflicted, expired and stale states are blocked.</li>
              <li>◆ The destination is re-resolved before handoff.</li>
              <li>◆ A changed address cancels the intent.</li>
              <li>◆ No key, seed phrase or automatic broadcast is used.</li>
            </ul>
            <p className="mt-3 font-mono text-[9px] leading-relaxed text-ivory-muted">
              last check {resolution ? timestamp(resolution.checkedAt) : "—"} · {resolution?.reasonCode ?? "not resolved"}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
