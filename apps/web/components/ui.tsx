"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import type { IdentityStatus } from "@kyvera/core";
import { STATUS_LABEL, statusClasses } from "@/lib/format";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-signal text-charcoal-950 hover:bg-signal-bright disabled:border disabled:border-ivory/10 disabled:bg-ivory/[0.06] disabled:text-ivory-muted",
    secondary:
      "border border-ivory/20 bg-transparent text-ivory hover:border-ivory/45 hover:bg-ivory/[0.04]",
    ghost: "text-ivory-dim hover:text-ivory hover:bg-ivory/[0.05]",
    danger:
      "border border-danger/40 bg-danger/[0.07] text-danger hover:bg-danger/[0.14] hover:border-danger/60",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-ivory/[0.13] bg-charcoal-900/55",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "border-ivory/18 bg-transparent text-ivory-dim",
    accent: "border-accent/45 bg-accent/[0.08] text-accent-bright",
    warn: "border-signal/45 bg-signal/[0.07] text-signal-bright",
    danger: "border-danger/45 bg-danger/[0.07] text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: IdentityStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]",
        statusClasses(status),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Semantic alias: a verification result must use the same status semantics. */
export const VerificationBadge = StatusBadge;

export function CopyableHash({
  value,
  label = "Hash",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <code className="min-w-0 flex-1 break-all font-mono text-[10px] leading-relaxed text-ivory-dim">
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ivory-muted"
    >
      {children}
    </label>
  );
}

const fieldClasses =
  "w-full rounded-lg border border-ivory/15 bg-charcoal-950/80 px-3.5 py-2.5 text-[13px] text-ivory placeholder:text-ivory-muted/60 transition-colors focus:border-signal/70 focus:outline-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClasses, "font-mono text-[12px] leading-relaxed", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-ivory-muted">{hint}</p> : null}
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 rounded-full border border-ivory/15 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ivory-muted transition-colors hover:border-ivory/40 hover:text-ivory"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "border-ivory/15 bg-ivory/[0.02] text-ivory-dim",
    warn: "border-signal/30 bg-signal/[0.04] text-signal-bright",
    danger: "border-danger/35 bg-danger/[0.05] text-danger",
    success: "border-accent/35 bg-accent/[0.05] text-accent-bright",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-[12px] leading-relaxed", tones[tone])}>
      {title ? <div className="mb-1 font-semibold">{title}</div> : null}
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em] text-ivory-muted">
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function Divider() {
  return <div className="h-px w-full bg-ivory/[0.1]" />;
}

export function GlassPanel({
  children,
  className,
  strong = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  id?: string;
}) {
  return (
    <div id={id} className={cn(strong ? "glass-strong" : "glass", "rounded-xl", className)}>
      {children}
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-ivory-muted">
      {children}
    </div>
  );
}
