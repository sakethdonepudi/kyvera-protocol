import Link from "next/link";
import { LifecycleDemo } from "@/components/lifecycle-demo";
import { FilmPreview } from "@/components/product-film";

const PRINCIPLES = [
  {
    number: "01",
    title: "History stays valid",
    body: "A retired wallet's signature remains mathematically true. It is simply no longer current.",
  },
  {
    number: "02",
    title: "Authorization is explicit",
    body: "Each transition is signed by the keys it moves away from and the key it moves toward.",
  },
  {
    number: "03",
    title: "Uncertainty is a result",
    body: "Incomplete relays, conflicts and failed proofs stay visible. The verifier never guesses.",
  },
];

const SURFACES = [
  {
    href: "/verify",
    title: "Verify an identity",
    body: "Resolve a current destination or inspect a historical proof.",
  },
  {
    href: "/challenge",
    title: "Run the challenge",
    body: "Follow bind, verify, authenticate, rotate and prove.",
  },
  {
    href: "/lab",
    title: "Open the security lab",
    body: "Replay equivocation, withholding and unauthorized rotation.",
  },
];

export default function LandingPage() {
  return (
    <div>
      <section className="border-b border-ivory/[0.08]">
        <div className="mx-auto max-w-[1060px] px-5 pb-12 pt-16 sm:pt-24">
          <div className="mx-auto max-w-[880px] text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-ivory/[0.1] bg-ivory/[0.02] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" />
              BCH Blaze 2026 · Paytaca identity bounty
            </div>

            <h1 className="mx-auto mt-7 max-w-[820px] font-display text-[48px] leading-[0.96] tracking-editorial text-ivory sm:text-[78px]">
              Your keys change.
              <br />
              <span className="text-signal">Your identity continues.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-[14px] leading-relaxed text-ivory-dim">
              Verifiable identity continuity across Bitcoin Cash wallet rotation and Nostr discovery.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/create"
                className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-[13px] font-semibold text-charcoal-950 transition-[background-color,transform] duration-200 hover:bg-signal-bright active:scale-[0.99]"
              >
                Create identity
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full border border-ivory/20 bg-ivory/[0.02] px-5 py-3 text-[13px] text-ivory transition-colors duration-200 hover:border-ivory/45 hover:bg-ivory/[0.05]"
              >
                Explore demo
              </Link>
            </div>

          </div>

          <div className="mt-14 sm:mt-16">
            <LifecycleDemo />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1060px] px-5 py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-ivory-muted">
              The film
            </div>
            <h2 className="mt-3 font-display text-[34px] leading-[1.05] tracking-editorial text-ivory sm:text-[42px]">
              See identity continuity.
            </h2>
          </div>
        </div>
        <div className="mt-8">
          <FilmPreview />
        </div>
      </section>

      <section id="protocol" className="mx-auto max-w-[1060px] px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <h2 className="max-w-[420px] font-display text-[34px] leading-[1.05] tracking-editorial text-ivory sm:text-[42px]">
            A valid signature is not a current authorization.
          </h2>
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
            {PRINCIPLES.map((item) => (
              <div key={item.number} className="border-t border-ivory/[0.12] pt-4">
                <div className="text-[10px] text-signal">{item.number}</div>
                <h3 className="mt-2 text-[14px] font-medium text-ivory">{item.title}</h3>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ivory-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-ivory/[0.08]">
        <div className="mx-auto grid max-w-[1060px] gap-8 px-5 py-16 sm:grid-cols-3 sm:gap-10">
          {SURFACES.map((surface) => (
            <Link key={surface.href} href={surface.href} className="group block">
              <div className="flex items-center justify-between border-t border-ivory/[0.12] pt-4">
                <h3 className="text-[15px] font-medium text-ivory">{surface.title}</h3>
                <span
                  aria-hidden="true"
                  className="text-ivory-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-signal"
                >
                  →
                </span>
              </div>
              <p className="mt-2 max-w-[260px] text-[11.5px] leading-relaxed text-ivory-muted">
                {surface.body}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1060px] px-5 py-20">
        <div className="glass flex flex-col justify-between gap-8 rounded-2xl p-7 sm:p-10 lg:flex-row lg:items-center">
          <div>
            <h2 className="max-w-lg font-display text-[30px] leading-[1.08] tracking-editorial text-ivory sm:text-[36px]">
              Verify it yourself. Without us.
            </h2>
            <p className="mt-3 max-w-lg text-[12px] leading-relaxed text-ivory-dim">
              The same TypeScript SDK powers the web app, the CLI and the security lab. No hosted
              verifier and no identity provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="rounded-full bg-signal px-5 py-3 text-[13px] font-semibold text-charcoal-950 transition-colors duration-200 hover:bg-signal-bright"
            >
              Create identity
            </Link>
            <Link
              href="/developers"
              className="rounded-full border border-ivory/20 px-5 py-3 text-[13px] text-ivory transition-colors duration-200 hover:border-ivory/45"
            >
              Read the SDK
            </Link>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-[9.5px] leading-relaxed text-ivory-muted">
          Research prototype. Not independently audited. Real-wallet interoperability, real-funds
          payments and production security remain untested or out of scope.
        </p>
      </section>
    </div>
  );
}
