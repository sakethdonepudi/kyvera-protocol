"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/#protocol", label: "Product" },
  { href: "/verify", label: "Verify" },
  { href: "/demo", label: "Demo" },
  { href: "/challenge", label: "Challenge" },
  { href: "/lab", label: "Security" },
  { href: "/developers", label: "Developers" },
];

function Mark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/kyvera-icon-256.png"
      alt=""
      width={size}
      height={size}
      className="rounded-[7px] object-cover"
      priority={size >= 32}
    />
  );
}

export function Header() {
  const pathname = usePathname();
  return (
    <header className="glass-nav sticky top-0 z-40">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-3">
          <span className="transition-opacity duration-200 group-hover:opacity-85">
            <Mark size={34} />
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-[0.24em] text-ivory">KYVERA</span>
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
                  "rounded-full px-3 py-2 text-[12px] transition-colors duration-200",
                  active
                    ? "bg-ivory/[0.07] text-ivory"
                    : "text-ivory-muted hover:bg-ivory/[0.04] hover:text-ivory",
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
            className="hidden rounded-full border border-ivory/15 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ivory-dim transition-colors duration-200 hover:border-ivory/35 hover:text-ivory sm:block"
          >
            Connect wallet
          </Link>
          <Link
            href="/create"
            className="rounded-full bg-signal px-3.5 py-2 text-[12px] font-semibold text-charcoal-950 transition-[background-color,transform] duration-200 hover:bg-signal-bright active:scale-[0.99]"
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
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ivory/[0.08] py-10">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 text-[11px] text-ivory-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5">
            <Mark size={24} />
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
            Demo
          </Link>
          <Link href="/challenge" className="hover:text-ivory">
            Challenge
          </Link>
          <Link href="/tutorial" className="hover:text-ivory">
            Film
          </Link>
          <Link href="/lab" className="hover:text-ivory">
            Security
          </Link>
          <Link href="/pay" className="hover:text-ivory">
            Pay
          </Link>
          <Link href="/developers" className="hover:text-ivory">
            Developers
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
        <p className="max-w-[210px] leading-relaxed">
          Open-source research prototype. Demo keys are throwaway and browser-local.
        </p>
      </div>
    </footer>
  );
}
