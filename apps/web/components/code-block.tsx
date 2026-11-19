"use client";

import { useState } from "react";

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative min-w-0 max-w-full overflow-hidden rounded-lg border border-ivory/[0.08] bg-ink-950/80">
      <div className="flex items-center justify-between border-b border-ivory/[0.06] px-3.5 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ivory-muted">{language}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="text-[10.5px] text-ivory-muted hover:text-ivory"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-pane overflow-auto p-4 font-mono text-[11px] leading-relaxed text-ivory-dim">
{code}
      </pre>
    </div>
  );
}
