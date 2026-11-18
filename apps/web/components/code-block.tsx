"use client";

import { useState } from "react";

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-ink-950/80">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{language}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="text-[10.5px] text-slate-500 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-pane overflow-auto p-4 font-mono text-[11px] leading-relaxed text-slate-300">
{code}
      </pre>
    </div>
  );
}
