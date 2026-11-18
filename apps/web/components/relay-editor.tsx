"use client";

import { useState } from "react";
import { Button, Input, cn } from "./ui";

const PRESETS = ["ws://127.0.0.1:7777", "wss://relay.damus.io", "wss://nos.lol"];

export function RelayEditor({
  relays,
  onChange,
  compact = false,
}: {
  relays: string[];
  onChange: (relays: string[]) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!/^wss?:\/\//.test(value)) return;
    if (!relays.includes(value)) onChange([...relays, value]);
    setDraft("");
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {relays.map((relay) => (
          <span
            key={relay}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px]",
              relay.startsWith("ws://127.") || relay.startsWith("ws://localhost")
                ? "border-accent/30 bg-accent/[0.07] text-accent-bright"
                : "border-white/10 bg-white/[0.03] text-slate-300",
            )}
          >
            {relay.replace(/^wss?:\/\//, "")}
            <button
              type="button"
              aria-label={`Remove ${relay}`}
              onClick={() => onChange(relays.filter((entry) => entry !== relay))}
              className="text-slate-500 hover:text-rose-300"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="wss://relay.example"
          className="py-2 text-[12px]"
        />
        <Button type="button" variant="secondary" onClick={add} className="shrink-0 px-3 py-2.5 text-[12px]">
          Add
        </Button>
      </div>
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
          <span>Presets:</span>
          {PRESETS.filter((preset) => !relays.includes(preset)).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange([...relays, preset])}
              className="rounded border border-white/10 px-1.5 py-0.5 font-mono hover:border-white/25 hover:text-slate-300"
            >
              {preset.replace(/^wss?:\/\//, "")}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
