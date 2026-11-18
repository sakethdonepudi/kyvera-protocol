import Link from "next/link";

const STATUSES = [
  ["ACTIVE", "Valid chain, current authorization"],
  ["SUPERSEDED", "Real historical binding, rotated away"],
  ["REVOKED", "Explicitly withdrawn by the keys"],
  ["EXPIRED", "Binding outlived its expiry"],
  ["CONFLICT", "The identity key equivocated"],
  ["STALE", "History incomplete or relays silent"],
  ["UNKNOWN", "No KYVERA records found"],
  ["INVALID", "Proofs or chain failed verification"],
];

function Mark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="34" height="34" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M13 1.8 23.2 7.6v10.8L13 24.2 2.8 18.4V7.6L13 1.8Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="m8.4 9.4 4.6 9 4.6-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 6.4v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="grid-surface pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 sm:pb-28 sm:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            BCH Blaze 2026 · Paytaca identity bounty
          </div>

          <div className="mt-8 grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h1 className="max-w-2xl text-balance text-[38px] font-semibold leading-[1.08] tracking-tightest text-white sm:text-[54px]">
                Your keys can change.
                <br />
                Your verified identity
                <br />
                <span className="text-accent">should remain trustworthy.</span>
              </h1>
              <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-slate-400">
                KYVERA cryptographically links a Bitcoin Cash payment identity to a Nostr identity —
                then keeps that link verifiable through rotation, revocation and compromise.
                A signature proves what happened. KYVERA proves what is authorized{" "}
                <span className="text-slate-200">now</span>.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-bright"
                >
                  Create a verifiable identity
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
                >
                  Verify an identity
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11.5px] text-muted">
                <span>◆ Dual-key proofs</span>
                <span>◆ Nostr-native discovery</span>
                <span>◆ No backend, no API key</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 -z-10 rounded-full bg-accent/[0.06] blur-3xl" />
              <div className="rounded-2xl border border-white/[0.09] bg-ink-850/90 p-5 shadow-glow">
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-accent">
                      <Mark />
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold text-white">Identity resolution</div>
                      <div className="font-mono text-[10px] text-slate-500">illustrative lifecycle</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-bright">
                    Active
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-white/[0.07] bg-ink-900/80 p-3.5">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted">
                      <span>Seq 0 · bind</span>
                      <span className="text-amber-300/80">superseded</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[12px] text-slate-500">
                      <span className="h-2 w-2 rounded-full border border-amber-400/60" />
                      wallet A · bitcoincash:q…a91f
                    </div>
                  </div>
                  <div className="ml-3 h-4 border-l border-dashed border-white/20" />
                  <div className="rounded-lg border border-accent/25 bg-accent/[0.05] p-3.5">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-accent/80">
                      <span>Seq 1 · rotate</span>
                      <span>current head</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[12px] text-white">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      wallet B · bitcoincash:q…7c02
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.06]">
                  {[
                    ["Proofs", "verified"],
                    ["Relays", "3 / 3"],
                    ["Chain", "intact"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-ink-900 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</div>
                      <div className="mt-0.5 text-[11px] text-slate-200">{value}</div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[10.5px] leading-relaxed text-slate-500">
                  A historical signature for wallet A stays cryptographically valid forever. It is not
                  the current payment identity — and KYVERA says so explicitly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
            The gap
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            A valid signature is not a valid identity.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-slate-400">
            Existing BCH↔Nostr bindings can prove that two keys were associated once. None of them
            answer the question a merchant, relay or application actually has: which address is
            authorized right now?
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Historical proofs never expire",
              body: "A signature from a compromised or retired wallet remains mathematically valid. Without an explicit sequence and revocation state, it can be replayed as current.",
            },
            {
              title: "A relay can withhold the newest state",
              body: "Sorting events by created_at lets an old binding look newest. Without a hash-linked chain and freshness reporting, a verifier cannot tell quiet from stale.",
            },
            {
              title: "Key compromise needs a lifecycle",
              body: "Rotation and revocation are authorization events, not key replacements. They must be signed under a documented policy — and rejected when they are not.",
            },
          ].map((item, index) => (
            <div key={item.title} className="rounded-xl border border-white/[0.08] bg-ink-850/60 p-5">
              <div className="font-mono text-[11px] text-accent/70">0{index + 1}</div>
              <h3 className="mt-3 text-[15px] font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
                The protocol
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Two independent keys.
                <br />
                One authorized state.
              </h2>
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-slate-400">
                Every binding is a Nostr event (NIP-78, kind 30078) whose author is the identity key and
                whose content is a canonical, hash-linked record. The BCH key signs a domain-separated
                proof over that exact record. Neither key is derived from the other.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["BIP-340 Schnorr", "ECDSA signmessage", "SHA-256 chain", "Canonical JSON"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10.5px] text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {[
                ["bind", "New BCH key + Nostr key", "Establishes the genesis binding at sequence 0."],
                ["rotate", "Current BCH + new BCH + Nostr", "The old wallet explicitly authorizes its replacement."],
                ["revoke", "Current BCH + Nostr", "Ends the identity. Historical proofs stay historical."],
              ].map(([type, keys, description]) => (
                <div
                  key={type}
                  className="grid gap-2 rounded-xl border border-white/[0.08] bg-ink-850/70 p-5 sm:grid-cols-[110px_1fr]"
                >
                  <div className="font-mono text-[12px] uppercase tracking-wider text-accent">{type}</div>
                  <div>
                    <div className="text-[13px] font-medium text-white">{keys}</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{description}</p>
                  </div>
                </div>
              ))}
              <p className="px-1 text-[11px] leading-relaxed text-muted">
                Consequence, stated plainly: losing the current BCH key blocks rotation. KYVERA does not
                pretend otherwise or hide a recovery shortcut.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
              Verification results
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Uncertainty is a result, not an error message.
            </h2>
          </div>
          <Link href="/verify" className="text-[13px] text-accent hover:text-accent-bright">
            Open the public verifier →
          </Link>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {STATUSES.map(([status, description]) => (
            <div key={status} className="bg-ink-900/80 p-4">
              <div
                className={
                  status === "ACTIVE"
                    ? "font-mono text-[11px] uppercase tracking-[0.12em] text-accent"
                    : ["CONFLICT", "INVALID", "REVOKED"].includes(status)
                      ? "font-mono text-[11px] uppercase tracking-[0.12em] text-rose-300"
                      : ["SUPERSEDED", "EXPIRED", "STALE"].includes(status)
                        ? "font-mono text-[11px] uppercase tracking-[0.12em] text-amber-300"
                        : "font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400"
                }
              >
                {status}
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.07] to-transparent p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Verify it yourself. Without us.
              </h2>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-slate-400">
                Every state in this app resolves from signed Nostr events through an open TypeScript
                SDK. The CLI reproduces the same result from a terminal.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/create"
                className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-bright"
              >
                Run the demo
              </Link>
              <Link
                href="/developers"
                className="rounded-lg border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/25"
              >
                Read the SDK
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
