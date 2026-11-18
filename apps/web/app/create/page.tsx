"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BchNetwork, KyveraEvent } from "@kyvera/core";
import { buildBchProofMessage } from "@kyvera/core";
import {
  decodeP2pkhAddress,
  generateBchKeyPair,
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
import {
  completeExternalBind,
  prepareExternalBind,
  publish,
  type BindDraft,
} from "@/lib/identity";
import { getNip07Provider, nip07Signer } from "@/lib/nip07";
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
type BchMode = "demo" | "external";
type Phase = "idle" | "publishing" | "published";

export default function CreatePage() {
  const [network, setNetwork] = useState<BchNetwork>(NETWORK);
  const [nostrMode, setNostrMode] = useState<NostrMode>("demo");
  const [nostrSecret, setNostrSecret] = useState<Uint8Array | null>(null);
  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [subject, setSubject] = useState("");
  const [nostrError, setNostrError] = useState("");

  const [bchMode, setBchMode] = useState<BchMode>("demo");
  const [demoBch, setDemoBch] = useState<BchKeyPair | null>(null);
  const [externalAddress, setExternalAddress] = useState("");
  const [signature, setSignature] = useState("");
  const [draft, setDraft] = useState<BindDraft | null>(null);
  const [draftError, setDraftError] = useState("");

  const [preview, setPreview] = useState<CreatedRecord | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [publishError, setPublishError] = useState("");
  const [reports, setReports] = useState<RelayPublishReport[] | null>(null);
  const [publishedEvent, setPublishedEvent] = useState<KyveraEvent | null>(null);

  const npub = useMemo(() => (subject ? toNpub(subject) : ""), [subject]);
  const address = bchMode === "demo" ? demoBch?.identity.address ?? "" : externalAddress.trim().toLowerCase();
  const addressCheck = address ? decodeP2pkhAddress(address) : null;
  const addressValid = addressCheck !== null && typeof addressCheck !== "string" && addressCheck.network === network;

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
      setDraft(prepareExternalBind({ subject, address, network }));
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : String(error));
    }
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
    (bchMode === "demo" ? Boolean(preview) : Boolean(draft) && Boolean(signature.trim()));

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
          Two independent keys, one canonical record. You will see the exact bytes each key signs
          before anything is published. Private keys never leave your browser or extension.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
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
                Generate a throwaway Nostr key for the demo, or connect a NIP-07 browser extension to
                sign with a key you already control.
              </p>
            )}
            {nostrError ? (
              <div className="mt-3">
                <Alert tone="danger">{nostrError}</Alert>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>02 · Bitcoin Cash identity</SectionLabel>
              <div className="flex rounded-lg border border-ivory/10 p-0.5">
                {(["demo", "external"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setBchMode(mode);
                      setDraft(null);
                      setDraftError("");
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] transition-colors",
                      bchMode === mode ? "bg-ivory/10 text-ivory" : "text-ivory-muted hover:text-ivory",
                    )}
                  >
                    {mode === "demo" ? "Generate wallet" : "External wallet"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted">Network</span>
              {(["mainnet", "chipnet"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setNetwork(value);
                    setDemoBch(null);
                    setDraft(null);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10.5px]",
                    network === value
                      ? "border-accent/40 bg-accent/10 text-accent-bright"
                      : "border-ivory/10 text-ivory-muted hover:text-ivory",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            {bchMode === "demo" ? (
              <div className="mt-3 space-y-3">
                {demoBch ? (
                  <div className="rounded-lg border border-ivory/[0.07] bg-ink-900/60 p-3.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted">Demo wallet</div>
                    <div className="mt-1 break-all font-mono text-[12.5px] text-ivory">
                      {demoBch.identity.address}
                    </div>
                    <div className="mt-1 break-all font-mono text-[10px] text-ivory-muted/70">
                      pubkey {demoBch.publicKey}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge tone="warn">unfunded</Badge>
                      <CopyButton value={demoBch.identity.address} label="Copy address" />
                    </div>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-ivory-muted">
                    A fresh P2PKH keypair is generated locally. It is used only to demonstrate the
                    proof and lifecycle; the address should stay unfunded.
                  </p>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDemoBch(generateBchKeyPair(network));
                    setDraft(null);
                  }}
                >
                  {demoBch ? "Generate a different wallet" : "Generate demo wallet"}
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <Field
                  label="BCH CashAddr (P2PKH)"
                  hint={`Must be a ${network} address. P2SH and token-aware addresses are rejected in v1 because signmessage proves a single key.`}
                >
                  <Input
                    value={externalAddress}
                    onChange={(event) => {
                      setExternalAddress(event.target.value);
                      setDraft(null);
                    }}
                    placeholder={network === "mainnet" ? "bitcoincash:q…" : "bchtest:q…"}
                    spellCheck={false}
                  />
                </Field>
                {externalAddress && !addressValid ? (
                  <Alert tone="danger">
                    {typeof addressCheck === "string"
                      ? addressCheck
                      : `This address is not a valid ${network} P2PKH CashAddr.`}
                  </Alert>
                ) : null}
                <Button variant="secondary" onClick={prepareMessage} disabled={!subject || !addressValid}>
                  Prepare the message to sign
                </Button>
                {draft ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-ivory/[0.07] bg-ink-900/70 p-3.5">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                          Sign this exact message in your wallet
                        </span>
                        <CopyButton value={draft.message} />
                      </div>
                      <pre className="scroll-pane whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-accent-bright/90">
{draft.message}
                      </pre>
                    </div>
                    <Field
                      label="Wallet signature"
                      hint="Cashonize, Electron Cash and Paytaca produce this base64 compact signature from their Sign Message feature."
                    >
                      <Textarea
                        rows={3}
                        value={signature}
                        onChange={(event) => setSignature(event.target.value)}
                        placeholder="Base64 signature (65 bytes)"
                        spellCheck={false}
                      />
                    </Field>
                  </div>
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
            ) : bchMode === "external" && draft ? (
              <div className="space-y-2">
                <p className="text-[12px] leading-relaxed text-ivory-muted">
                  The record commits to this digest. Your BCH signature covers the domain-separated
                  message, and the Nostr event covers the canonical record containing both proofs.
                </p>
                <pre className="scroll-pane max-h-64 overflow-auto rounded-lg border border-ivory/[0.07] bg-ink-950/70 p-3.5 font-mono text-[10.5px] leading-relaxed text-ivory-dim">
{JSON.stringify(draft.payload, null, 2)}
                </pre>
                <div className="font-mono text-[10px] text-ivory-muted/70">payload digest {draft.digest}</div>
              </div>
            ) : (
              <p className="text-[12.5px] text-ivory-muted">
                Configure both keys to preview the signed payload. Nothing is published yet.
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
                  <Spinner /> Signing and publishing…
                </>
              ) : (
                "Sign and publish binding"
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
                  pnpm cli {npub} --relay ws://127.0.0.1:7777
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Publishing writes one signed Nostr event. If the local demo relay is not running,
                the record is still saved in this browser and can be re-published later.
              </p>
            )}
          </Card>
        </div>
      </div>
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
