import Image from "next/image";
import Link from "next/link";
import { LifecycleDemo } from "@/components/lifecycle-demo";

const STATUSES = [
  ["ACTIVE", "Valid chain, current authorization"],
  ["SUPERSEDED", "Valid history, rotated away"],
  ["REVOKED", "Ended by the current keys"],
  ["EXPIRED", "Authorization outlived its window"],
  ["CONFLICT", "The identity key equivocated"],
  ["STALE", "History or relays are incomplete"],
  ["UNKNOWN", "No records found"],
  ["INVALID", "Proofs or transitions failed"],
];

export default function LandingPage() {
  return (
    <div>
      <section className="border-b border-ivory/[0.1]">
        <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/kyvera-icon-256.png"
                alt=""
                width={48}
                height={48}
                priority
                className="h-11 w-11 rounded-lg object-cover"
              />
              <div>
                <div className="font-display text-[21px] leading-none tracking-[0.26em] text-ivory">KYVERA</div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-ivory-muted">
                  Identity continuity protocol
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-[9px] uppercase leading-relaxed tracking-[0.16em] text-ivory-muted">
              BCH Blaze 2026
              <br />
              Paytaca identity bounty
            </div>
          </div>

          <div className="mt-12 grid items-start gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <h1 className="max-w-[760px] font-display text-[46px] leading-[0.98] tracking-editorial text-ivory sm:text-[68px]">
                Your keys change.
                <br />
                Your identity
                <br />
                <span className="text-signal">continues.</span>
              </h1>
              <p className="mt-8 max-w-xl text-[14px] leading-relaxed text-ivory-dim">
                Cryptographically verify Bitcoin Cash and Nostr identities across wallet rotation,
                revocation, and decentralized discovery.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-[13px] font-semibold text-charcoal-950 transition-colors hover:bg-signal-bright"
                >
                  Create Identity
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/challenge"
                  className="inline-flex items-center gap-2 rounded-full border border-ivory/25 bg-ivory/[0.03] px-5 py-3 text-[13px] text-ivory backdrop-blur-sm transition-colors hover:border-ivory/55 hover:bg-ivory/[0.07]"
                >
                  Try Trust Challenge
                </Link>
                <Link
                  href="/tutorial"
                  className="inline-flex items-center gap-2 rounded-full border border-signal/35 bg-signal/[0.05] px-5 py-3 text-[13px] text-signal-bright transition-colors hover:bg-signal/[0.1]"
                >
                  Watch Demo
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/verify"
                  className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ivory-muted hover:text-signal"
                >
                  Verify an identity →
                </Link>
                <Link
                  href="/pay"
                  className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ivory-muted hover:text-signal"
                >
                  Pay by identity →
                </Link>
                <a
                  href="/kyvera-standalone.html"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ivory-muted underline decoration-ivory/20 underline-offset-4 hover:text-signal"
                >
                  No-install standalone demo ↗
                </a>
                <Link
                  href="/lab"
                  className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ivory-muted hover:text-signal"
                >
                  Security lab →
                </Link>
              </div>

              <div className="mt-10 grid max-w-lg grid-cols-3 gap-px bg-ivory/[0.1]">
                {[
                  ["136", "automated tests"],
                  ["8", "explicit states"],
                  ["0", "verification servers"],
                ].map(([value, label]) => (
                  <div key={label} className="bg-charcoal-950 px-3 py-4">
                    <div className="font-display text-[26px] leading-none text-ivory">{value}</div>
                    <div className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ivory-muted">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pt-2">
              <div className="glass rounded-2xl p-1.5">
                <LifecycleDemo />
              </div>
              <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-[0.06em] text-ivory-muted">
                This is an actual verification run in your browser, not a recorded animation. The fixture
                keys are deterministic and unspendable.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 pb-2 pt-4">
        <Link
          href="/tutorial"
          className="group grid gap-5 rounded-2xl border border-ivory/[0.1] bg-ivory/[0.02] p-4 transition-colors hover:border-ivory/25 sm:grid-cols-[1.15fr_1fr] sm:items-center"
        >
          <div className="relative aspect-video overflow-hidden rounded-xl border border-ivory/[0.08] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/demo/kyvera-explainer-poster.jpg"
              alt="KYVERA Trust Challenge demonstration poster"
              className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
              width={1920}
              height={1080}
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ivory/30 bg-charcoal-950/70 text-[18px] text-ivory backdrop-blur-sm">
                ▶
              </span>
            </span>
          </div>
          <div className="px-2 pb-2 sm:py-4">
            <div className="kicker text-signal">Watch the 90-second explainer</div>
            <h2 className="mt-3 font-display text-[28px] leading-tight tracking-editorial text-ivory">
              The trust model,
              <br />
              without the jargon.
            </h2>
            <p className="mt-2 max-w-md text-[12px] leading-relaxed text-ivory-muted">
              Dual-key binding, independent verification, rotation and the difference between a valid
              old proof and a current authorization.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-signal">
              Watch Demo →
            </span>
          </div>
        </Link>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <div className="kicker">01 / The gap</div>
            <h2 className="mt-4 font-display text-[34px] leading-[1.08] tracking-editorial text-ivory">
              A valid signature
              <br />
              is not a current
              <br />
              authorization.
            </h2>
            <p className="mt-5 max-w-sm text-[12.5px] leading-relaxed text-ivory-dim">
              Existing bindings prove that two keys were associated once. They rarely answer which
              address a payer should trust <em>now</em>.
            </p>
          </div>

          <div className="grid gap-px bg-ivory/[0.1] sm:grid-cols-3">
            {[
              [
                "01",
                "History never expires",
                "A signature from a retired or compromised wallet stays mathematically valid forever. Recency is not authorization.",
              ],
              [
                "02",
                "Newest is not authorized",
                "Sorting events by created_at lets a stale relay, a replayed binding or an equivocating key look current.",
              ],
              [
                "03",
                "Silence is not freshness",
                "A verifier that cannot reach enough relays must say so. Falling back to an older address is a payment risk.",
              ],
            ].map(([number, title, body]) => (
              <div key={number} className="bg-charcoal-950 p-5">
                <div className="font-mono text-[9px] tracking-[0.14em] text-signal">{number}</div>
                <h3 className="mt-3 font-display text-[19px] leading-tight text-ivory">{title}</h3>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ivory-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="protocol" className="border-y border-ivory/[0.1] bg-charcoal-900/40">
        <div className="mx-auto max-w-[1240px] px-5 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="kicker">02 / The chain</div>
              <h2 className="mt-4 font-display text-[34px] leading-[1.08] tracking-editorial text-ivory">
                Identity is a sequence,
                <br />
                not a directory entry.
              </h2>
              <p className="mt-5 max-w-md text-[12.5px] leading-relaxed text-ivory-dim">
                Every KYVERA record commits to the previous record&apos;s digest. The chain starts at a
                genesis binding and can only move forward through explicitly authorized transitions.
              </p>
              <div className="mt-7 border border-ivory/[0.14]">
                <div className="grid grid-cols-[64px_1fr] border-b border-ivory/[0.1]">
                  <div className="border-r border-ivory/[0.1] p-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ivory-muted">
                    bind
                  </div>
                  <div className="p-3">
                    <div className="font-mono text-[10px] text-ivory">NEW BCH KEY + NOSTR KEY</div>
                    <div className="mt-1 text-[10.5px] text-ivory-muted">Sequence 0. No predecessor.</div>
                  </div>
                </div>
                <div className="grid grid-cols-[64px_1fr] border-b border-ivory/[0.1]">
                  <div className="border-r border-ivory/[0.1] p-3 font-mono text-[9px] uppercase tracking-[0.12em] text-signal">
                    rotate
                  </div>
                  <div className="p-3">
                    <div className="font-mono text-[10px] text-ivory">CURRENT BCH + NEW BCH + NOSTR</div>
                    <div className="mt-1 text-[10.5px] text-ivory-muted">
                      The old wallet authorizes leaving. The new wallet proves control.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-[64px_1fr]">
                  <div className="border-r border-ivory/[0.1] p-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ivory-muted">
                    revoke
                  </div>
                  <div className="p-3">
                    <div className="font-mono text-[10px] text-ivory">CURRENT BCH + NOSTR</div>
                    <div className="mt-1 text-[10.5px] text-ivory-muted">
                      Terminal. Later transitions are rejected as conflict.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="kicker">03 / The difference</div>
              <h2 className="mt-4 font-display text-[34px] leading-[1.08] tracking-editorial text-ivory">
                What competitors answer,
                <br />
                and what they don&apos;t.
              </h2>
              <div className="mt-5 space-y-4 text-[12px] leading-relaxed text-ivory-dim">
                <p>
                  <span className="text-ivory">Kola Link</span> publishes a signed message and an optional
                  XO anchor; rotation is a new binding and the newest event wins.{" "}
                  <span className="text-ivory">CashLink ID</span> orders rotations with an on-chain
                  commitment and also selects the newest event.{" "}
                  <span className="text-ivory">BCH Identity Bridge</span> marks prior bindings with
                  revocation/supersession events discovered at verification time.
                </p>
                <p className="border-l-2 border-signal/70 pl-3">
                  None of the inspected implementations resolves a <span className="text-ivory">hash-linked
                  authorization chain</span> with explicit `SUPERSEDED`, `CONFLICT` and `STALE` results.
                  Newest-wins cannot distinguish a replay from a rotation, or a quiet identity from a
                  withholding relay.
                </p>
                <p>
                  KYVERA does not claim those projects are insecure. They make different scope choices.
                  The evidence and source references are in the{" "}
                  <a
                    href="https://github.com/sakethdonepudi/kyvera-protocol/blob/main/docs/COMPETITIVE_AUDIT_2026.md"
                    className="text-ivory underline decoration-ivory/25 underline-offset-4 hover:text-signal"
                  >
                    competitive audit
                  </a>
                  .
                </p>
              </div>
              <Link
                href="/lab"
                className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-signal hover:text-signal-bright"
              >
                See the adversarial scenarios run →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="kicker">04 / The time machine</div>
            <h2 className="mt-3 font-display text-[34px] leading-[1.08] tracking-editorial text-ivory">
              Inspect the state transition,
              <br />
              not just the badge.
            </h2>
          </div>
          <Link href="/demo" className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal hover:text-signal-bright">
            Open the guided demo →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            ["Record digests", "Payload digest, full-record digest and the predecessor link are exposed for every step."],
            ["Both proofs", "The exact BCH proof message, recovered address and Nostr Schnorr signature are inspectable."],
            ["Relay observations", "Which relay supplied each record, plus explicit FULL / PARTIAL / UNSYNCED freshness."],
          ].map(([title, body]) => (
            <div key={title} className="border border-ivory/[0.12] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-signal">instrument</div>
              <h3 className="mt-3 text-[14px] font-medium text-ivory">{title}</h3>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ivory-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="kicker">05 / Pay by identity</div>
            <h2 className="mt-3 font-display text-[34px] leading-[1.08] tracking-editorial text-ivory">
              Pay the person.
              <br />
              Verify the destination.
            </h2>
            <p className="mt-4 max-w-md text-[12.5px] leading-relaxed text-ivory-dim">
              Resolve an npub, verify the current BCH authorization chain, then hand a BIP21 payment to
              Paytaca, Selene, Cashonize or Electron Cash. No key, no custody, no fabricated receipt.
            </p>
            <Link
              href="/pay"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-[13px] font-semibold text-charcoal-950 hover:bg-signal-bright"
            >
              Open KYVERA Pay →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["WizardConnect", "Pair Paytaca or Cashonize and derive the wallet address locally."],
              ["BIP21 handoff", "The wallet previews and broadcasts the payment. KYVERA never auto-broadcasts."],
              ["Honest receipt", "This handoff does not return a txid, so no receipt is invented. A txid-aware adapter is future work."],
            ].map(([title, body], index) => (
              <div key={title} className="glass rounded-xl p-5">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-signal">0{index + 1}</div>
                <h3 className="mt-3 text-[14px] font-medium text-ivory">{title}</h3>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ivory-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ivory/[0.1]">
        <div className="mx-auto max-w-[1240px] px-5 py-20">
          <div className="kicker">06 / The result space</div>
          <h2 className="mt-4 max-w-2xl font-display text-[34px] leading-[1.08] tracking-editorial text-ivory">
            Uncertainty is a result,
            <br />
            not an error toast.
          </h2>
          <div className="mt-8 grid gap-px bg-ivory/[0.1] sm:grid-cols-2 lg:grid-cols-4">
            {STATUSES.map(([status, description]) => (
              <div key={status} className="bg-charcoal-950 p-4">
                <div
                  className={
                    status === "ACTIVE"
                      ? "font-mono text-[10px] uppercase tracking-[0.14em] text-accent"
                      : ["REVOKED", "CONFLICT", "INVALID"].includes(status)
                        ? "font-mono text-[10px] uppercase tracking-[0.14em] text-danger"
                        : status === "SUPERSEDED" || status === "STALE"
                          ? "font-mono text-[10px] uppercase tracking-[0.14em] text-signal"
                          : "font-mono text-[10px] uppercase tracking-[0.14em] text-ivory-muted"
                  }
                >
                  {status}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-ivory-muted">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 pb-8">
        <div className="grid gap-8 border border-ivory/[0.14] p-7 sm:p-9 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="font-display text-[30px] leading-tight tracking-editorial text-ivory">
              Verify it yourself. Without us.
            </h2>
            <p className="mt-3 max-w-xl text-[12.5px] leading-relaxed text-ivory-dim">
              The same TypeScript SDK powers the web app, the CLI and the security lab. No API key, no
              hosted verifier, no centralized identity provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <Link
              href="/create"
              className="rounded-[2px] bg-signal px-5 py-3 text-[13px] font-semibold text-charcoal-950 hover:bg-signal-bright"
            >
              Create an identity
            </Link>
            <Link
              href="/developers"
              className="rounded-[2px] border border-ivory/25 px-5 py-3 text-[13px] text-ivory hover:border-ivory/55"
            >
              Read the SDK
            </Link>
          </div>
        </div>
        <p className="mt-4 max-w-3xl font-mono text-[9px] leading-relaxed tracking-[0.06em] text-ivory-muted">
          KYVERA does not claim recovery after losing all authorized keys, absolute rollback protection
          against a colluding relay set, or production readiness without an independent audit and live
          wallet testing.
        </p>
      </section>
    </div>
  );
}
