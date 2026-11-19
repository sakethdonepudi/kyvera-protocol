import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

const REPO = "https://github.com/sakethdonepudi/kyvera-protocol";

const VERIFY_SNIPPET = `import { KyveraClient } from "@kyvera/sdk";

const client = new KyveraClient({
  relays: ["wss://nos.lol", "wss://relay.primal.net"],
});

const result = await client.verify(npub);

console.log(result.status);                 // ACTIVE, REVOKED, STALE, ...
console.log(result.currentAuthorization.authorized);
console.log(result.currentAuthorization.usableForSensitiveOperations);
console.log(result.historicalValidity.records);
console.log(result.evidenceCompleteness.assurance);`;

const OFFLINE_SNIPPET = `import { resolveEvents } from "@kyvera/sdk";

// events: signed KYVERA events fetched by any means, in any order.
const { resolution } = resolveEvents(events, {
  now: Math.floor(Date.now() / 1000),
  network: "mainnet",
});

// A record can be valid while the chain is not:
//   record valid  !=  currently authorized`;

const ROTATE_SNIPPET = `import { createRotateRecord } from "@kyvera/sdk";

const rotation = await createRotateRecord({
  signer,                          // current Nostr key
  previous: {
    recordId: head.recordId,       // digest of the current head
    sequence: head.record.payload.sequence,
    bch: head.record.payload.bch,  // currently authorized wallet
  },
  currentBchPrivateKey: oldWallet, // authorizes leaving
  newBchPrivateKey: newWallet,     // proves control of the new wallet
  newBch: newBchIdentity,
});

// rotation.event is the signed Nostr event to publish.`;

const AUTH_SNIPPET = `import { AuthRequestService } from "@kyvera/sdk/auth";

const service = new AuthRequestService({
  origin: "https://app.example",
  ttlSeconds: 120,
  sessionTtlSeconds: 900,
});

const request = service.issue({ expectedSubject: subject });
// Sign request with the user's Nostr key, then:
const { check, session } = service.verify(event, resolution);
if (!check.authenticated) deny(check.code);

// Re-resolve before validating a session:
service.validate(session.token, freshResolution);`;

const CLI_LINES = `# build the workspace and run the verifier
pnpm install
pnpm build

pnpm cli npub1… --relay wss://relay.damus.io --relay wss://nos.lol

# offline: verify a JSON array of events
pnpm cli --file events.json

# check a payment address
pnpm cli --address bitcoincash:q… --relay ws://127.0.0.1:7777`;

const DEMO_LINES = `# terminal 1 — local relay with persistent demo state
pnpm relay

# terminal 2 — web application
pnpm dev

# terminal 3 — verify the same identity independently
pnpm cli npub1… --relay ws://127.0.0.1:7777`;

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
          Developers
        </div>
        <h1 className="mt-3 font-display text-[38px] leading-[1.05] tracking-editorial text-ivory">
          Verification is a library call, not a service.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ivory-muted">
          KYVERA ships as a strict TypeScript monorepo. The cryptographic core has no network or
          framework dependencies; relay discovery is a separate package. There is no API key and no
          KYVERA backend in the verification path.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["@kyvera/sdk", "developer façade, structured verification, evidence"],
          ["@kyvera/verifier", "chain resolution, relay discovery, auth, CLI"],
          ["@kyvera/core", "canonical JSON, records, chain state machine"],
          ["@kyvera/bch", "CashAddr + wallet signmessage proofs"],
          ["@kyvera/nostr", "public + legacy events, relay queries, publishing"],
          ["@kyvera/wallet-bch", "capability model + manual proof verification"],
        ].map(([pkg, description]) => (
          <div key={pkg} className="rounded-lg border border-ivory/[0.08] bg-ink-850/60 p-4">
            <div className="font-mono text-[11.5px] text-accent">{pkg}</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ivory-muted">{description}</p>
          </div>
        ))}
      </div>

      <section className="mt-12 space-y-8">
        <div>
          <h2 className="text-[15px] font-semibold text-ivory">Resolve the current state</h2>
          <p className="mt-1 text-[12px] text-ivory-muted">
            The SDK queries every relay independently, verifies each record, walks the chain and returns
            cryptographic validity, historical validity, current authorization and evidence completeness
            as separate fields.
          </p>
          <div className="mt-3">
            <CodeBlock code={VERIFY_SNIPPET} language="ts" />
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold text-ivory">Verify without a relay</h2>
          <p className="mt-1 text-[12px] text-ivory-muted">
            Historical validity and current authorization stay separate, even when the evidence is
            supplied by another system.
          </p>
          <div className="mt-3">
            <CodeBlock code={OFFLINE_SNIPPET} language="ts" />
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold text-ivory">Authorize a rotation</h2>
          <p className="mt-1 text-[12px] text-ivory-muted">
            Three signatures: current BCH key, new BCH key, and the Nostr identity key. Omitting any one
            produces an invalid record or an invalid transition.
          </p>
          <div className="mt-3">
            <CodeBlock code={ROTATE_SNIPPET} language="ts" />
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold text-ivory">Challenge-response authentication</h2>
          <p className="mt-1 text-[12px] text-ivory-muted">
            Single-use kind-22242 requests, verified against the resolved state. Challenges are consumed
            before verification and sessions re-resolve the chain.
          </p>
          <div className="mt-3">
            <CodeBlock code={AUTH_SNIPPET} language="ts" />
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ivory">CLI verification</h2>
          <p className="mt-1 text-[12px] text-ivory-muted">
            Exit code 0 means a conclusive lifecycle state; 1 means uncertain or invalid.
          </p>
          <div className="mt-3">
            <CodeBlock code={CLI_LINES} language="bash" />
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ivory">Reproduce the demo</h2>
          <p className="mt-1 text-[12px] text-ivory-muted">
            The local relay persists demo events so the browser and CLI see the same signed history.
          </p>
          <div className="mt-3">
            <CodeBlock code={DEMO_LINES} language="bash" />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[15px] font-semibold text-ivory">Protocol at a glance</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-ivory/[0.08]">
          <table className="w-full text-left text-[12px]">
            <tbody className="divide-y divide-ivory/[0.06]">
              {[
                ["Nostr event", "public kind 1078 + legacy kind 30078, d = kyvera:v1:<subject>:<seq>:<payload digest>"],
                ["Canonical bytes", "KCJ-1: sorted keys, no whitespace, NFC, integers only"],
                ["BCH proof", "signmessage compact ECDSA over KYVERA/v1/bch-proof + role + address + digest"],
                ["Nostr proof", "BIP-340 Schnorr signature over the event"],
                ["Chain link", "previous = sha256(canonical previous signed record)"],
                ["Rotation policy", "current BCH + new BCH + Nostr key"],
                ["Revocation policy", "current BCH + Nostr key; no transitions afterwards"],
                ["Freshness", "per-relay reports; zero relays ⇒ STALE, partial ⇒ PARTIAL"],
                ["Rollback guard", "optional caller checkpoint on (sequence, recordId)"],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="w-44 bg-ink-900/60 px-4 py-3 align-top font-medium text-ivory-dim">{label}</td>
                  <td className="px-4 py-3 font-mono text-[11px] leading-relaxed text-ivory-muted">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-ivory/[0.08] bg-ink-850/60 p-5">
          <h3 className="text-[13px] font-semibold text-ivory">Documentation</h3>
          <ul className="mt-2 space-y-1.5 text-[12px] text-ivory-muted">
            {[
              ["Protocol specification", `${REPO}/blob/main/docs/PROTOCOL_SPEC.md`],
              ["SDK quickstart", `${REPO}/blob/main/docs/SDK_QUICKSTART.md`],
              ["Wallet adapters", `${REPO}/blob/main/docs/WALLET_ADAPTERS.md`],
              ["Nostr discovery RFC", `${REPO}/blob/main/docs/protocol/NOSTR_DISCOVERY_RFC.md`],
              ["Threat model", `${REPO}/blob/main/docs/security/THREAT_MODEL_V5.md`],
              ["Known limitations", `${REPO}/blob/main/docs/security/KNOWN_LIMITATIONS.md`],
              ["Competitive audit 2026", `${REPO}/blob/main/docs/COMPETITIVE_AUDIT_2026.md`],
              ["KYVERA 3.0 competitive analysis", `${REPO}/blob/main/docs/KYVERA_3_COMPETITIVE_ANALYSIS.md`],
              ["KYVERA Pay", `${REPO}/blob/main/docs/KYVERA_PAY.md`],
              ["Relying-party compliance", `${REPO}/blob/main/docs/PAYTACA_COMPLIANCE.md`],
              ["Wallet API audit", `${REPO}/blob/main/docs/WALLET_UX_AUDIT.md`],
              ["Wallet device test", `${REPO}/blob/main/docs/WALLET_DEVICE_TEST.md`],
              ["Design system", `${REPO}/blob/main/docs/DESIGN_SYSTEM.md`],
              ["Security test report", `${REPO}/blob/main/docs/SECURITY_TEST_REPORT.md`],
            ].map(([label, href]) => (
              <li key={label}>
                <a href={href} className="text-ivory-dim underline decoration-white/20 underline-offset-4 hover:text-accent">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-ivory/[0.08] bg-ink-850/60 p-5">
          <h3 className="text-[13px] font-semibold text-ivory">Wallet interoperability</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-ivory-muted">
            Run a real <code className="text-ivory-dim">signmessage</code> probe with Electron Cash,
            Cashonize or Paytaca and record the actual result. No compatibility is claimed until a real
            signature row exists.
          </p>
          <Link
            href="/interop"
            className="mt-3 inline-block rounded-full border border-ivory/20 px-3 py-2 text-[12px] text-ivory hover:border-ivory/45"
          >
            Open the wallet probe
          </Link>
        </div>
        <div className="rounded-xl border border-ivory/[0.08] bg-ink-850/60 p-5">
          <h3 className="text-[13px] font-semibold text-ivory">Test vectors</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-ivory-muted">
            Deterministic vectors covering canonical encoding, wallet signatures, all three record types
            and six chain outcomes.
          </p>
          <a
            href="/vectors.json"
            className="mt-3 inline-block rounded-lg border border-ivory/12 px-3 py-2 text-[12px] text-ivory-dim hover:border-ivory/25"
          >
            Download vectors.json
          </a>
          <a
            href="/kyvera-standalone.html"
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-[11px] text-signal hover:text-signal-bright"
          >
            Open the no-install standalone demo ↗
          </a>
          <p className="mt-3 text-[10.5px] leading-relaxed text-ivory-muted">
            All keys in the vectors are unspendable, derived from labels. Never fund their addresses.
          </p>
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-ivory/[0.08] bg-ink-850/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-ivory">Standalone relying party</h3>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent-bright">
            10/10 checks
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-ivory-muted">
          Build deterministic records, issue a single-use challenge, verify rotation, revoke the
          identity, persist a session across process restarts and invalidate it without calling any
          KYVERA API or relay.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg border border-ivory/12 px-3 py-2 font-mono text-[11px] text-ivory-dim">
            pnpm rp:demo
          </code>
          <code className="rounded-lg border border-ivory/12 px-3 py-2 font-mono text-[11px] text-ivory-dim">
            pnpm rp:persist
          </code>
          <Link href="/auth-demo" className="text-[11.5px] text-signal hover:text-signal-bright">
            Browser relying-party demo →
          </Link>
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-signal/20 bg-signal/[0.04] p-5">
        <h3 className="text-[13px] font-semibold text-signal-bright">Explicit limitations</h3>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-amber-100/70">
          <li>◆ No recovery if the current BCH key and the Nostr key are both lost. This is a policy choice, not an oversight.</li>
          <li>◆ Off-chain history cannot be proven complete against a relay set that withholds it. Checkpoints detect known rollbacks only.</li>
          <li>◆ v1 supports P2PKH signmessage proofs, not multisig, hardware-wallet PSBT flows or CashTokens commitments.</li>
          <li>◆ The browser demo stores throwaway keys in localStorage. It is not a production wallet.</li>
        </ul>
      </section>

      <div className="mt-10">
        <Link href="/verify" className="text-[13px] text-accent hover:text-accent-bright">
          Try the verifier →
        </Link>
      </div>
    </div>
  );
}
