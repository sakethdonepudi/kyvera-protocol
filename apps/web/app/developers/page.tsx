import Link from "next/link";
import { CodeBlock } from "@/components/code-block";

const REPO = "https://github.com/sakethdonepudi/kyvera-protocol";

const VERIFY_SNIPPET = `import { resolveIdentity } from "@kyvera/verifier";

const result = await resolveIdentity({
  subject: "64-char-hex-nostr-pubkey",
  relays: ["wss://relay.damus.io", "wss://nos.lol"],
});

if (result.status === "ACTIVE") {
  console.log("pay to", result.activeBch?.address);
} else {
  console.log(result.status, result.reason);
}`;

const OFFLINE_SNIPPET = `import { resolveEvents } from "@kyvera/verifier";

// events: signed NIP-78 events fetched by any means, in any order.
const { resolution } = resolveEvents(events, {
  now: Math.floor(Date.now() / 1000),
  network: "mainnet",
});

// A record can be valid while the chain is not:
//   record valid  !=  currently authorized`;

const ROTATE_SNIPPET = `import { createRotateRecord } from "@kyvera/verifier";

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

const AUTH_SNIPPET = `import { ChallengeService } from "@kyvera/verifier";

const service = new ChallengeService({ domain: "app.example", ttlSeconds: 300 });
const challenge = service.issue();

// Send challenge.challenge to the user, receive a kind-22242 event, then:
const result = service.verify(event, identityResolution);
if (!result.authenticated) deny(result.code);`;

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
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Verification is a library call, not a service.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">
          KYVERA ships as a strict TypeScript monorepo. The cryptographic core has no network or
          framework dependencies; relay discovery is a separate package. There is no API key and no
          KYVERA backend in the verification path.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["@kyvera/core", "canonical JSON, records, chain state machine"],
          ["@kyvera/bch", "CashAddr + wallet signmessage proofs"],
          ["@kyvera/nostr", "NIP-78 events, relay queries, publishing"],
        ].map(([pkg, description]) => (
          <div key={pkg} className="rounded-lg border border-white/[0.08] bg-ink-850/60 p-4">
            <div className="font-mono text-[11.5px] text-accent">{pkg}</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{description}</p>
          </div>
        ))}
      </div>

      <section className="mt-12 space-y-8">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Resolve the current state</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            The only call most applications need. It queries every relay independently, verifies each
            record, walks the chain and reports assurance.
          </p>
          <div className="mt-3">
            <CodeBlock code={VERIFY_SNIPPET} language="ts" />
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold text-white">Verify without a relay</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            Historical validity and current authorization are deliberately separate. This distinction is
            the core contribution.
          </p>
          <div className="mt-3">
            <CodeBlock code={OFFLINE_SNIPPET} language="ts" />
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold text-white">Authorize a rotation</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            Three signatures: current BCH key, new BCH key, and the Nostr identity key. Omitting any one
            produces an invalid record or an invalid transition.
          </p>
          <div className="mt-3">
            <CodeBlock code={ROTATE_SNIPPET} language="ts" />
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold text-white">Challenge-response authentication</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            NIP-42-shaped kind 22242 events, verified against the resolved state. The relying app owns
            challenge storage.
          </p>
          <div className="mt-3">
            <CodeBlock code={AUTH_SNIPPET} language="ts" />
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="text-[15px] font-semibold text-white">CLI verification</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            Exit code 0 means a conclusive lifecycle state; 1 means uncertain or invalid.
          </p>
          <div className="mt-3">
            <CodeBlock code={CLI_LINES} language="bash" />
          </div>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Reproduce the demo</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            The local relay persists demo events so the browser and CLI see the same signed history.
          </p>
          <div className="mt-3">
            <CodeBlock code={DEMO_LINES} language="bash" />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[15px] font-semibold text-white">Protocol at a glance</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08]">
          <table className="w-full text-left text-[12px]">
            <tbody className="divide-y divide-white/[0.06]">
              {[
                ["Nostr event", "kind 30078 (NIP-78), d = kyvera:v1:<subject>:<seq>:<payload digest>"],
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
                  <td className="w-44 bg-ink-900/60 px-4 py-3 align-top font-medium text-slate-300">{label}</td>
                  <td className="px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-400">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-ink-850/60 p-5">
          <h3 className="text-[13px] font-semibold text-white">Documentation</h3>
          <ul className="mt-2 space-y-1.5 text-[12px] text-slate-400">
            {[
              ["Protocol specification", `${REPO}/blob/main/docs/PROTOCOL.md`],
              ["Threat model", `${REPO}/blob/main/docs/THREAT_MODEL.md`],
              ["Security limitations", `${REPO}/blob/main/docs/SECURITY_LIMITATIONS.md`],
              ["Competitor analysis", `${REPO}/blob/main/docs/COMPETITOR_ANALYSIS.md`],
              ["Security test report", `${REPO}/blob/main/docs/SECURITY_TEST_REPORT.md`],
            ].map(([label, href]) => (
              <li key={label}>
                <a href={href} className="text-slate-300 underline decoration-white/20 underline-offset-4 hover:text-accent">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-ink-850/60 p-5">
          <h3 className="text-[13px] font-semibold text-white">Test vectors</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
            Deterministic vectors covering canonical encoding, wallet signatures, all three record types
            and six chain outcomes.
          </p>
          <a
            href="/vectors.json"
            className="mt-3 inline-block rounded-lg border border-white/12 px-3 py-2 text-[12px] text-slate-200 hover:border-white/25"
          >
            Download vectors.json
          </a>
          <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">
            All keys in the vectors are unspendable, derived from labels. Never fund their addresses.
          </p>
        </div>
      </section>

      <section className="mt-12 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
        <h3 className="text-[13px] font-semibold text-amber-200">Explicit limitations</h3>
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
