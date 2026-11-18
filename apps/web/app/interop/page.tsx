"use client";

import { useEffect, useState } from "react";
import {
  decodeP2pkhAddress,
  verifyBitcoinMessageSignature,
  type SignatureCheck,
} from "@kyvera/bch";
import { Alert, Badge, Button, Card, CopyButton, Field, Input, SectionLabel, Textarea, cn } from "@/components/ui";
import { timestamp } from "@/lib/format";

const PROBE_MESSAGE = [
  "KYVERA wallet compatibility probe v1",
  "This signature proves control of this BCH address for testing.",
  "It authorizes no payment and can be discarded.",
  "nonce: 7f3a9c2e5b1d8046a9c4e2f7b0d6a1c8",
].join("\n");

const REFERENCE = {
  address: "bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen",
  message: [
    "nostr-bch-bind:v1",
    "npub:3a5bce3ac4e98bbc0b231ebbab2647bdacef00478e6b9515c853806e303ced94",
    "bch:bitcoincash:qzavy69mgnnrzz5ua0td95ee4n298dvs2uuyrtlwen",
    "created:1794000000",
  ].join("\n"),
  signature:
    "Hxa2Bc7VquIL7IWRY0r9IXxrqURhqzjZRI0Q306JLroCOOm/4M+iT8HkXDUiSkbR9DF6loHGB5TA7qDfoCH5p9A=",
};

interface Probe {
  id: string;
  wallet: string;
  version: string;
  method: string;
  address: string;
  ok: boolean;
  detail: string;
  publicKey?: string;
  at: number;
}

const STORAGE = "kyvera.walletProbes.v1";

export default function InteropPage() {
  const [address, setAddress] = useState("");
  const [signature, setSignature] = useState("");
  const [wallet, setWallet] = useState("");
  const [version, setVersion] = useState("");
  const [method, setMethod] = useState("signmessage");
  const [result, setResult] = useState<SignatureCheck | null>(null);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setProbes(JSON.parse(localStorage.getItem(STORAGE) ?? "[]") as Probe[]);
    } catch {
      setProbes([]);
    }
  }, []);

  function persist(next: Probe[]) {
    setProbes(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  }

  function verify() {
    setError("");
    setResult(null);
    try {
      const decoded = decodeP2pkhAddress(address.trim().toLowerCase());
      if (typeof decoded === "string") throw new Error(`invalid CashAddr: ${decoded}`);
      if (!signature.trim()) throw new Error("paste the base64 signature produced by the wallet");
      const check = verifyBitcoinMessageSignature(address.trim().toLowerCase(), PROBE_MESSAGE, signature.trim());
      setResult(check);
      persist([
        {
          id: `${Date.now()}`,
          wallet: wallet.trim() || "unlabelled",
          version: version.trim() || "unrecorded",
          method,
          address: address.trim().toLowerCase(),
          ok: check.ok,
          detail: check.ok ? "signature recovers to the declared address" : check.message,
          publicKey: check.publicKey,
          at: Date.now(),
        },
        ...probes,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function verifyReference() {
    setError("");
    const check = verifyBitcoinMessageSignature(REFERENCE.address, REFERENCE.message, REFERENCE.signature);
    setResult(check);
    setAddress(REFERENCE.address);
    setSignature(REFERENCE.signature);
    setWallet("nostr-bch-bind reference");
    setVersion("published vector");
    setMethod("signmessage");
    persist([
      {
        id: `${Date.now()}`,
        wallet: "nostr-bch-bind reference",
        version: "published vector",
        method: "signmessage",
        address: REFERENCE.address,
        ok: check.ok,
        detail: check.ok ? "independent implementation vector verified" : check.message,
        publicKey: check.publicKey,
        at: Date.now(),
      },
      ...probes,
    ]);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12">
      <div className="max-w-2xl">
        <div className="kicker text-signal">Wallet interoperability</div>
        <h1 className="mt-3 font-display text-[38px] leading-[1.05] tracking-editorial text-ivory">
          Test a real wallet signature.
          <br />
          Claim nothing you haven&apos;t run.
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-ivory-dim">
          KYVERA verifies the standard BCH `signmessage` format. This probe lets you sign a fixed message
          in Electron Cash, Cashonize or Paytaca and record the actual result. Until a row says verified,
          no wallet compatibility is claimed.
        </p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Card className="p-5">
          <SectionLabel>Probe message</SectionLabel>
          <div className="flex items-start justify-between gap-3">
            <pre className="scroll-pane whitespace-pre-wrap border border-ivory/[0.1] bg-charcoal-950/70 p-3 font-mono text-[10.5px] leading-relaxed text-ivory-dim">
{PROBE_MESSAGE}
            </pre>
            <CopyButton value={PROBE_MESSAGE} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Wallet name">
              <Input value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="Electron Cash" />
            </Field>
            <Field label="Version">
              <Input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="4.4.x" />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Signing method">
              <div className="flex flex-wrap gap-2">
                {["signmessage", "wizardconnect-tx", "other"].map((value) => (
                  <button
                    key={value}
                    onClick={() => setMethod(value)}
                    className={cn(
                      "border px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em]",
                      method === value
                        ? "border-signal/60 bg-signal/[0.06] text-signal-bright"
                        : "border-ivory/15 text-ivory-muted hover:border-ivory/35",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="mt-3 space-y-3">
            <Field label="BCH address" hint="P2PKH CashAddr used to sign the probe message.">
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="bitcoincash:q…"
                spellCheck={false}
                className="font-mono text-[11px]"
              />
            </Field>
            <Field label="Signature (base64)" hint="65-byte compact recoverable signature from the wallet.">
              <Textarea
                rows={3}
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                placeholder="H…="
                spellCheck={false}
              />
            </Field>
          </div>

          {error ? (
            <div className="mt-3">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={verify}>Verify wallet signature</Button>
            <Button variant="secondary" onClick={verifyReference}>
              Verify independent reference vector
            </Button>
          </div>

          {result ? (
            <div
              className={cn(
                "mt-4 border p-4",
                result.ok ? "border-accent/45 bg-accent/[0.05]" : "border-danger/45 bg-danger/[0.05]",
              )}
            >
              <div className="flex items-center gap-2">
                <Badge tone={result.ok ? "accent" : "danger"}>{result.ok ? "verified" : "rejected"}</Badge>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ivory-muted">
                  {result.code}
                </span>
              </div>
              <p className="mt-2 text-[11.5px] text-ivory-dim">{result.message}</p>
              {result.publicKey ? (
                <p className="mt-2 break-all font-mono text-[9.5px] text-ivory-muted">{result.publicKey}</p>
              ) : null}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionLabel>How to produce a signature</SectionLabel>
            <ol className="space-y-3 text-[11.5px] leading-relaxed text-ivory-dim">
              <li>
                <span className="text-ivory">01.</span> Open the wallet that controls the address. Use an
                unfunded or dedicated test address.
              </li>
              <li>
                <span className="text-ivory">02.</span> Find the wallet&apos;s <em>Sign message</em> feature.
                Menu labels vary by wallet and version; do not guess — record what you used.
              </li>
              <li>
                <span className="text-ivory">03.</span> Paste the probe message exactly, sign it, and copy
                the base64 signature. Never share a seed phrase or private key.
              </li>
              <li>
                <span className="text-ivory">04.</span> Enter the address, signature and wallet version
                here. A successful result means the recovered key hashes to the address.
              </li>
            </ol>
            <div className="mt-4">
              <Alert tone="warn" title="Not a compatibility claim">
                This form records results. It does not assert that a wallet has been tested until a real
                signature row exists with a wallet name and version.
              </Alert>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Recorded probes</SectionLabel>
              {probes.length > 0 ? (
                <button
                  onClick={() => persist([])}
                  className="font-mono text-[9px] uppercase tracking-[0.1em] text-ivory-muted hover:text-[#E5A49C]"
                >
                  clear
                </button>
              ) : null}
            </div>
            {probes.length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-ivory-muted">
                No wallet signatures recorded yet. The reference vector is an independent implementation,
                not a wallet.
              </p>
            ) : (
              <ul className="space-y-2">
                {probes.map((probe) => (
                  <li key={probe.id} className="border-b border-ivory/[0.07] pb-2 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={probe.ok ? "accent" : "danger"}>{probe.ok ? "pass" : "fail"}</Badge>
                      <span className="text-[11px] text-ivory">{probe.wallet}</span>
                      <span className="font-mono text-[9px] text-ivory-muted">{probe.version}</span>
                      <span className="ml-auto font-mono text-[8.5px] text-ivory-muted">
                        {timestamp(Math.floor(probe.at / 1000))}
                      </span>
                    </div>
                    <div className="mt-1 break-all font-mono text-[9px] text-ivory-muted">
                      {probe.address}
                    </div>
                    <div className="mt-0.5 text-[10px] text-ivory-muted">{probe.detail}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
