"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/#protocol", label: "Product" },
  { href: "/verify", label: "Verify" },
  { href: "/demo", label: "Time Machine" },
  { href: "/challenge", label: "Challenge" },
  { href: "/lab", label: "Security Lab" },
  { href: "/developers", label: "Developers" },
];

function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="23" height="23" stroke="currentColor" strokeWidth="1" />
      <circle cx="13" cy="10.5" r="3.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M13 13.7v6.1M10.3 17h5.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 6.5h2M18.5 6.5h2M5.5 19.5h2M18.5 19.5h2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-ivory/[0.12] bg-charcoal-950/70 shadow-[0_12px_40px_-30px_rgba(0,0,0,0.8)] backdrop-blur-glass">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-3">
          <span className="text-ivory transition-colors group-hover:text-signal">
            <Mark />
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-[0.26em] text-ivory">KYVERA</span>
            <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.18em] text-ivory-muted">
              Identity continuity
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/#protocol" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-b border-transparent px-3 py-2 text-[12px] transition-colors",
                  active
                    ? "border-signal text-ivory"
                    : "text-ivory-muted hover:border-ivory/30 hover:text-ivory",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            href="/pay#wallet"
            className="hidden rounded-full border border-ivory/18 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ivory-dim transition-colors hover:border-ivory/40 hover:text-ivory sm:block"
          >
            Connect wallet
          </Link>
          <Link
            href="/create"
            className="rounded-full bg-signal px-3.5 py-2 text-[12px] font-semibold text-charcoal-950 transition-colors hover:bg-signal-bright"
          >
            Create identity
          </Link>
        </div>
      </div>
      <div className="border-t border-ivory/[0.07] px-5 py-2 lg:hidden">
        <nav className="scroll-pane mx-auto flex max-w-2xl items-center justify-between gap-2 overflow-x-auto" aria-label="Primary mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em]",
                pathname === item.href ? "text-signal" : "text-ivory-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/pay#wallet" className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-ivory-dim">
            Connect wallet
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ivory/[0.1] py-10">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 text-[11px] text-ivory-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-ivory/70">
            <Mark size={22} />
          </span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory">
              KYVERA / Identity continuity protocol
            </div>
            <div className="mt-1">Keys change. Trust shouldn&apos;t disappear.</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/verify" className="hover:text-ivory">
            Verify
          </Link>
          <Link href="/demo" className="hover:text-ivory">
            Time Machine
          </Link>
          <Link href="/challenge" className="hover:text-ivory">
            Trust Challenge
          </Link>
          <Link href="/lab" className="hover:text-ivory">
            Security Lab
          </Link>
          <Link href="/pay" className="hover:text-ivory">
            Pay
          </Link>
          <Link href="/interop" className="hover:text-ivory">
            Wallet probe
          </Link>
          <Link href="/auth-demo" className="hover:text-ivory">
            Auth demo
          </Link>
          <Link href="/merchant" className="hover:text-ivory">
            Merchant demo
          </Link>
          <a
            href="https://github.com/sakethdonepudi/kyvera-protocol"
            className="hover:text-ivory"
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>
        </div>
        <p className="max-w-sm leading-relaxed">
          Open-source research prototype for BCH Blaze 2026. Verification is independent of any KYVERA
          server. Demo keys are throwaway and browser-local.
        </p>
      </div>
    </footer>
  );
}
