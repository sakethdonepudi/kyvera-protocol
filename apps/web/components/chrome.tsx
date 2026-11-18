"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const NAV = [
  { href: "/create", label: "Create" },
  { href: "/verify", label: "Verify" },
  { href: "/auth", label: "Authenticate" },
  { href: "/developers", label: "Developers" },
];

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path
        d="M13 1.8 23.2 7.6v10.8L13 24.2 2.8 18.4V7.6L13 1.8Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="m8.4 9.4 4.6 9 4.6-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 6.4v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="text-accent transition-colors group-hover:text-accent-bright">
            <Mark />
          </span>
          <span className="text-[15px] font-semibold tracking-[0.22em] text-white">KYVERA</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-[13px] transition-colors",
                  active ? "bg-white/[0.06] text-white" : "text-slate-400 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/create"
          className="rounded-lg border border-accent/35 bg-accent/10 px-3.5 py-2 text-[12.5px] font-medium text-accent-bright transition-colors hover:bg-accent/15"
        >
          Create identity
        </Link>
      </div>
      <div className="border-t border-white/[0.05] px-5 py-2 sm:hidden">
        <nav className="flex items-center justify-center gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-[12px]",
                pathname === item.href ? "text-white" : "text-slate-400",
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
    <footer className="mt-24 border-t border-white/[0.06] py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-accent/70">
            <Mark />
          </span>
          <span>
            KYVERA — <span className="text-slate-400">Identity. Proven.</span>
          </span>
        </div>
        <p className="max-w-xl leading-relaxed">
          Open-source protocol prototype for BCH Blaze 2026. Verification is independent of any KYVERA
          server. Demo keys are throwaway and stored only in your browser.
        </p>
      </div>
    </footer>
  );
}
