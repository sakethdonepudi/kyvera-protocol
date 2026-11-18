"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BchNetwork, KyveraEvent } from "@kyvera/core";
import { buildBchProofMessage } from "@kyvera/core";
import {
  decodeP2pkhAddress,
  generateBchKeyPair,
  verifyBitcoinMessageSignature,
  type BchKeyPair,
} from "@kyvera/bch";
import {
  generateNostrSecretKey,
  signerFromSecretKey,
  toNpub,
  type NostrSigner,
  type RelayPublishReport,
} from "@kyvera/nostr";
import { createBindRecord, type CreatedRecord } from "@kyvera/verifier";
import { binToHex } from "@bitauth/libauth";
import { useWizardConnect, WizardConnectQRDialog } from "@wizardconnect/react";
import {
  completeExternalBind,
  prepareExternalBind,
  publish,
  type BindDraft,
} from "@/lib/identity";
import { getNip07Provider, nip07Signer } from "@/lib/nip07";
import { deriveWalletAddress } from "@/lib/wallet";
import { saveIdentity, type StoredIdentity } from "@/lib/store";
import { DEFAULT_RELAYS, NETWORK } from "@/lib/config";
import { shortAddress, shortHex } from "@/lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Field,
  Input,
  SectionLabel,
  Spinner,
  Textarea,
  cn,
} from "@/components/ui";
import { RelayEditor } from "@/components/relay-editor";

type NostrMode = "demo" | "nip07";
type BchMode = "wallet" | "demo" | "external";
type Phase = "idle" | "publishing" | "published";

export default function CreatePage() {
  const [network, setNetwork] = useState<BchNetwork>(NETWORK);
  const [nostrMode, setNostrMode] = useState<NostrMode>("demo");
  const [nostrSecret, setNostrSecret] = useState<Uint8Array | null>(null);
  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [subject, setSubject] = useState("");
  const [nostrError, setNostrError] = useState("");

  const [bchMode, setBchMode] = useState<BchMode>("wallet");
  const [demoBch, setDemoBch] = useState<BchKeyPair | null>(null);
  const [externalAddress, setExternalAddress] = useState("");
  const [signature, setSignature] = useState("");
  const [draft, setDraft] = useState<BindDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [signatureCheck, setSignatureCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const wallet = useWizardConnect({
    dappName: "KYVERA",
    sessionKey: "kyvera-create-wallet",
  });

  const [preview, setPreview] = useState<CreatedRecord | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [publishError, setPublishError] = useState("");
  const [reports, setReports] = useState<RelayPublishReport[] | null>(null);
  const [publishedEvent, setPublishedEvent] = useState<KyveraEvent | null>(null);

  const walletAddress = useMemo(
    () => (wallet.state === "connected" ? deriveWalletAddress(wallet.manager, network) : null),
    [wallet.state, wallet.manager, network],
  );

  const npub = useMemo(() => (subject ? toNpub(subject) : ""), [subject]);
  const address = bchMode === "demo" ? demoBch?.identity.address ?? "" : externalAddress.trim().toLowerCase();
  const addressCheck = address ? decodeP2pkhAddress(address) : null;
  const addressValid = addressCheck !== null && typeof addressCheck !== "string" && addressCheck.network === network;

  useEffect(() => {
    if (bchMode !== "wallet") return;
    setDraft(null);
    setSignature("");
    setSignatureCheck(null);
    if (walletAddress) setExternalAddress(walletAddress);
    else setExternalAddress("");
  }, [bchMode, walletAddress]);

  useEffect(() => {
    if (bchMode !== "wallet" || !subject || !walletAddress || !addressValid) return;
    if (draft && draft.payload.bch && draft.payload.bch.address === walletAddress) return;
    prepareMessage();
    // prepareMessage is stable for these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bchMode, subject, walletAddress, addressValid, address, network]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setPreviewError("");
    if (!signer || !subject || bchMode !== "demo" || !demoBch) return;
    createBindRecord({
      signer,
      bchPrivateKey: demoBch.privateKey,
      bch: demoBch.identity,
      issuedAt: Math.floor(Date.now() / 1000),
    })
      .then((created) => {
        if (!cancelled) setPreview(created);
      })
      .catch((error) => {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [signer, subject, bchMode, demoBch]);

  async function connectNostr(mode: NostrMode) {
    setNostrError("");
    setNostrMode(mode);
    setSigner(null);
    setSubject("");
    setNostrSecret(null);
    setPreview(null);
    try {
      if (mode === "demo") {
        const secret = generateNostrSecretKey();
        const local = signerFromSecretKey(secret);
        const pubkey = await local.getPublicKey();
        setNostrSecret(secret);
        setSigner(local);
        setSubject(pubkey);
      } else {
        const provider = getNip07Provider();
        if (!provider) throw new Error("No NIP-07 extension detected. Install a Nostr signer such as Alby or nos2x.");
        const external = nip07Signer(provider);
        const pubkey = await external.getPublicKey();
        setSigner(external);
        setSubject(pubkey);
      }
    } catch (error) {
      setNostrError(error instanceof Error ? error.message : String(error));
    }
  }

  function prepareMessage() {
    setDraftError("");
    setDraft(null);
    try {
      if (!subject) throw new Error("configure the Nostr identity first");
      if (!address) throw new Error("enter a BCH address");
      if (typeof addressCheck === "string") throw new Error(addressCheck ?? "invalid address");
      if (!addressCheck || addressCheck.network !== network) {
        throw new Error(`address must be a ${network} P2PKH CashAddr`);
      }
      setSignatureCheck(null);
      setDraft(prepareExternalBind({ subject, address, network }));
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : String(error));
    }
  }

  function verifySignature() {
    if (!draft) return;
    const result = verifyBitcoinMessageSignature(address, draft.message, signature.trim());
    setSignatureCheck({
      ok: result.ok,
      message: result.ok ? "Signature recovers to this address." : result.message,
    });
  }

  async function onPublish() {
    setPublishError("");
    setReports(null);
    if (!signer || !subject) {
      setPublishError("configure the Nostr identity first");
      return;
    }
    setPhase("publishing");
    try {
      let event: KyveraEvent;
      if (bchMode === "demo") {
        if (!preview) throw new Error("preview is not ready yet");
        event = preview.event;
      } else {
        if (!draft) throw new Error("prepare and sign the BCH proof message first");
        if (!signature.trim()) throw new Error("paste the wallet signature");
        event = await completeExternalBind({ signer, draft, signature });
      }

      const stored: StoredIdentity = {
        subject,
        npub,
        mode: nostrSecret ? "demo" : "nip07",
        nostrSecret: nostrSecret ? binToHex(nostrSecret) : null,
        bchKeys: demoBch
          ? [
              {
                address: demoBch.identity.address,
                network,
                publicKey: demoBch.publicKey,
                privateKey: binToHex(demoBch.privateKey),
              },
            ]
          : [],
        events: [event],
        createdAt: Date.now(),
      };
      saveIdentity(stored);
      setPublishedEvent(event);
      const result = await publish(relays, event);
      setReports(result);
      setPhase("published");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : String(error));
      setPhase("idle");
    }
  }

  const canPublish =
    Boolean(signer) &&
    Boolean(subject) &&
    addressValid &&
    (bchMode === "demo"
      ? Boolean(preview)
      : Boolean(draft) && Boolean(signature.trim()) && signatureCheck?.ok === true);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
          Create identity
        </div>
        <h1 className="mt-3 font-display text-[38px] leading-[1.05] tracking-editorial text-ivory">
          Bind a Nostr identity to a BCH wallet.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ivory-muted">
          Two keys, one canonical record. You see the exact bytes before publishing. Private keys
          never leave your browser.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>01 · Nostr identity</SectionLabel>
              <div className="flex rounded-lg border border-ivory/10 p-0.5">
                {(["demo", "nip07"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => connectNostr(mode)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] transition-colors",
                      nostrMode === mode ? "bg-ivory/10 text-ivory" : "text-ivory-muted hover:text-ivory",
                    )}
                  >
                    {mode === "demo" ? "Generate key" : "NIP-07"}
                  </button>
                ))}
              </div>
            </div>

            {subject ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-ivory/[0.07] bg-ink-900/60 p-3.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted">Public identity</div>
                  <div className="mt-1 break-all font-mono text-[12px] text-ivory-dim">{npub}</div>
                  <div className="mt-1 break-all font-mono text-[10px] text-ivory-muted/70">{subject}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={nostrSecret ? "warn" : "accent"}>
                      {nostrSecret ? "demo signer" : "NIP-07 signer"}
                    </Badge>
                    <CopyButton value={npub} label="Copy npub" />
                  </div>
                </div>
                {nostrSecret ? (
                  <Alert tone="warn" title="Demo key generated in this browser">
                    This key is stored in localStorage so the lifecycle demo can rotate and revoke. It
                    is throwaway material. Never use it for a real identity or a funded wallet.
                  </Alert>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] leading-relaxed text-ivory-muted">
                Generate a throwaway key, or connect a NIP-07 signer.
              </p>
            )}
            {nostrError ? (
              <div className="mt-3">
                <Alert tone="danger">{nostrError}</Alert>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>02 · BCH identity</SectionLabel>
              <div className="flex rounded-full border border-ivory/10 p-0.5">
                {([
                  ["wallet", "Connect"],
                  ["demo", "Demo"],
                  ["external", "Paste"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setBchMode(mode);
                      setDraft(null);
                      setSignature("");
                      setSignatureCheck(null);
                      setDraftError("");
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10.5px] transition-colors",
                      bchMode === mode ? "bg-ivory text-charcoal-950" : "text-ivory-muted hover:text-ivory",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ivory-muted">Network</span>
              {(["mainnet", "chipnet"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setNetwork(value);
                    setDemoBch(null);
                    setDraft(null);
                    setSignatureCheck(null);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
                    network === value
                      ? "border-accent/45 bg-accent/10 text-accent-bright"
                      : "border-ivory/12 text-ivory-muted hover:text-ivory",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            {bchMode === "wallet" ? (
              <div className="mt-4 space-y-3">
                {walletAddress ? (
                  <>
                    <div className="rounded-xl border border-accent/30 bg-accent/[0.04] p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
                          {wallet.walletName ?? "Connected wallet"}
                        </span>
                        <Badge tone="neutral">address connected</Badge>
                      </div>
                      <div className="mt-1 font-mono text-[14px] text-ivory" title={walletAddress}>
                        {shortAddress(walletAddress)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CopyButton value={walletAddress} />
                        <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={() => void wallet.disconnect()}>
                          Disconnect
                        </Button>
                      </div>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-[10.5px] text-ivory-muted hover:text-ivory-dim">
                        Why sign in your wallet?
                      </summary>
                      <p className="mt-1.5 text-[10.5px] leading-relaxed text-ivory-muted">
                        WizardConnect reads the address but does not expose message signing. Use the
                        wallet&apos;s Sign Message feature on the text below, then paste the signature.
                      </p>
                    </details>
                    {draft ? (
                      <SignatureStep
                        draft={draft}
                        signature={signature}
                        check={signatureCheck}
                        onSignature={(value) => {
                          setSignature(value);
                          setSignatureCheck(null);
                        }}
                        onVerify={verifySignature}
                      />
                    ) : (
                      <p className="text-[11.5px] text-ivory-muted">
                        Generate a Nostr key to prepare the proof message.
                      </p>
                    )}
                    {draftError ? <Alert tone="danger">{draftError}</Alert> : null}
                  </>
                ) : (
                  <>
                    <Button onClick={() => wallet.connect()} disabled={wallet.state === "connecting"}>
                      {wallet.state === "connecting" ? <Spinner /> : null} Connect Wallet
                    </Button>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ivory-muted">
                      Paytaca · Selene · Cashonize
                    </p>
                  </>
                )}
                {wallet.error ? <Alert tone="danger">{wallet.error}</Alert> : null}
                {wallet.uri && wallet.qrUri ? (
                  <WizardConnectQRDialog
                    show={wallet.state === "connecting"}
                    onClose={() => void wallet.disconnect()}
                    uri={wallet.uri}
                    qrUri={wallet.qrUri}
                    title="KYVERA"
                    subtitle="Scan with Paytaca, Selene or Cashonize"
                  />
                ) : null}
                {draft ? (
                  <SignatureStep
                    draft={draft}
                    signature={signature}
                    check={signatureCheck}
                    onSignature={(value) => {
                      setSignature(value);
                      setSignatureCheck(null);
                    }}
                    onVerify={verifySignature}
                  />
                ) : null}
              </div>
            ) : bchMode === "demo" ? (
              <div className="mt-4 space-y-3">
                {demoBch ? (
                  <div className="rounded-xl border border-ivory/[0.1] bg-charcoal-950/40 p-3.5">
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">Demo wallet</div>
                    <div className="mt-1 break-all font-mono text-[12px] text-ivory">{demoBch.identity.address}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge tone="warn">unfunded</Badge>
                      <CopyButton value={demoBch.identity.address} label="Copy address" />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11.5px] leading-relaxed text-ivory-muted">
                    A throwaway local keypair for the demo. Never fund it.
                  </p>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDemoBch(generateBchKeyPair(network));
                    setDraft(null);
                    setSignatureCheck(null);
                  }}
                >
                  {demoBch ? "New demo wallet" : "Generate demo wallet"}
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Input
                  value={externalAddress}
                  onChange={(event) => {
                    setExternalAddress(event.target.value);
                    setDraft(null);
                    setSignature("");
                    setSignatureCheck(null);
                  }}
                  placeholder={network === "mainnet" ? "bitcoincash:q…" : "bchtest:q…"}
                  spellCheck={false}
                  className="font-mono text-[11px]"
                />
                {externalAddress && !addressValid ? (
                  <Alert tone="danger">
                    {typeof addressCheck === "string"
                      ? addressCheck
                      : `Not a valid ${network} P2PKH address.`}
                  </Alert>
                ) : null}
                <Button variant="secondary" onClick={prepareMessage} disabled={!subject || !addressValid}>
                  Continue
                </Button>
                {draft ? (
                  <SignatureStep
                    draft={draft}
                    signature={signature}
                    check={signatureCheck}
                    onSignature={(value) => {
                      setSignature(value);
                      setSignatureCheck(null);
                    }}
                    onVerify={verifySignature}
                  />
                ) : null}
                {draftError ? <Alert tone="danger">{draftError}</Alert> : null}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionLabel>03 · What each key signs</SectionLabel>
            {bchMode === "demo" && preview && preview.record.payload.bch ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-ivory-dim">BCH proof message</span>
                    <CopyButton
                      value={buildBchProofMessage(
                        "new",
                        preview.record.payload.bch.address,
                        preview.payloadDigest,
                      )}
                    />
                  </div>
                  <pre className="scroll-pane max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-ivory/[0.07] bg-ink-950/70 p-3.5 font-mono text-[11px] leading-relaxed text-accent-bright/90">
{buildBchProofMessage("new", preview.record.payload.bch.address, preview.payloadDigest)}
                  </pre>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10.5px] text-ivory-muted hover:text-ivory-dim">
                      Show signed payload fields
                    </summary>
                    <pre className="scroll-pane mt-2 max-h-52 overflow-auto rounded-lg border border-ivory/[0.07] bg-ink-950/70 p-3.5 font-mono text-[10.5px] leading-relaxed text-ivory-muted">
{JSON.stringify(preview.record.payload, null, 2)}
                    </pre>
                  </details>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-ivory-dim">Nostr event content (canonical record)</span>
                    <CopyButton value={preview.event.content} />
                  </div>
                  <pre className="scroll-pane max-h-52 overflow-auto rounded-lg border border-ivory/[0.07] bg-ink-950/70 p-3.5 font-mono text-[10.5px] leading-relaxed text-ivory-muted">
{preview.event.content}
                  </pre>
                  <div className="mt-2 font-mono text-[10px] text-ivory-muted/70">
                    kind {preview.event.kind} · created_at {preview.event.created_at} · id{" "}
                    {shortHex(preview.event.id, 12, 8)}
                  </div>
                </div>
              </div>
            ) : bchMode !== "demo" && draft ? (
              <div className="space-y-2">
                <p className="text-[12px] leading-relaxed text-ivory-muted">
                  The BCH signature covers the proof message. The Nostr event covers the canonical
                  record containing both proofs.
                </p>
                <pre className="scroll-pane max-h-64 overflow-auto rounded-lg border border-ivory/[0.07] bg-ink-950/70 p-3.5 font-mono text-[10.5px] leading-relaxed text-ivory-dim">
{JSON.stringify(draft.payload, null, 2)}
                </pre>
                <div className="font-mono text-[10px] text-ivory-muted/70">payload digest {draft.digest}</div>
              </div>
            ) : (
              <p className="text-[12.5px] text-ivory-muted">
                Configure both keys to preview the signed payload.
              </p>
            )}
            {previewError ? <Alert tone="danger">{previewError}</Alert> : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 lg:sticky lg:top-24">
            <SectionLabel>Publish</SectionLabel>
            <div className="space-y-3 text-[12px]">
              <Row label="Subject" value={subject ? shortHex(subject, 10, 8) : "—"} />
              <Row label="BCH" value={address ? shortAddress(address) : "—"} />
              <Row label="Network" value={network} />
              <Row label="Records" value="1 (bind, seq 0)" />
              <Row label="Relays" value={String(relays.length)} />
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted">Relays</div>
              <RelayEditor relays={relays} onChange={setRelays} compact />
            </div>

            {publishError ? (
              <div className="mt-3">
                <Alert tone="danger">{publishError}</Alert>
              </div>
            ) : null}

            <Button
              className="mt-4 w-full"
              onClick={onPublish}
              disabled={!canPublish || phase === "publishing"}
            >
              {phase === "publishing" ? (
                <>
                  <Spinner /> Publishing…
                </>
              ) : (
                "Publish identity"
              )}
            </Button>

            {phase === "published" && publishedEvent ? (
              <div className="mt-4 space-y-3">
                <Alert tone="success" title="Binding published">
                  The record is signed by both keys. Relay acceptance is reported below.
                </Alert>
                <div className="space-y-1.5">
                  {(reports ?? []).map((report) => (
                    <div key={report.url} className="flex items-center gap-2 text-[10.5px]">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          report.ok ? "bg-accent" : "bg-danger",
                        )}
                      />
                      <span className="truncate font-mono text-ivory-muted">
                        {report.url.replace(/^wss?:\/\//, "")}
                      </span>
                      <span className="ml-auto text-ivory-muted/70">{report.ok ? `${report.latencyMs}ms` : "failed"}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/identity/${npub}`}
                  className="block rounded-[2px] bg-signal px-4 py-2.5 text-center text-[13px] font-semibold text-charcoal-950 hover:bg-signal-bright"
                >
                  Open the identity dashboard →
                </Link>
                <p className="break-all rounded-lg border border-ivory/[0.07] bg-ink-950/60 p-2.5 font-mono text-[9.5px] leading-relaxed text-ivory-muted">
                  pnpm cli {npub} --relay {relays[0] ?? "wss://relay.damus.io"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Signed locally. Saved in this browser even if the relay is offline.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SignatureStep({
  draft,
  signature,
  check,
  onSignature,
  onVerify,
}: {
  draft: BindDraft;
  signature: string;
  check: { ok: boolean; message: string } | null;
  onSignature: (value: string) => void;
  onVerify: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-ivory/[0.1] bg-charcoal-950/40 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">Sign this message</span>
          <CopyButton value={draft.message} />
        </div>
        <pre className="scroll-pane max-h-36 overflow-auto whitespace-pre-wrap break-all font-mono text-[10.5px] leading-relaxed text-accent-bright">
{draft.message}
        </pre>
      </div>
      <Textarea
        rows={3}
        value={signature}
        onChange={(event) => onSignature(event.target.value)}
        placeholder="Base64 wallet signature"
        spellCheck={false}
      />
      <Button variant="secondary" onClick={onVerify} disabled={!signature.trim()}>
        Verify ownership
      </Button>
      {check ? <Alert tone={check.ok ? "success" : "danger"}>{check.ok ? "Verified" : check.message}</Alert> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="truncate font-mono text-[11px] text-ivory-dim">{value}</span>
    </div>
  );
}
