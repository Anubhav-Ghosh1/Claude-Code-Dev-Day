"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ code, label, maxHeight }: { code: string; label?: string; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-page">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="text-[11.5px] text-muted">{label}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label ?? "code"}`}
          className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-raised hover:text-ink"
        >
          {copied ? <Check size={12} className="text-good" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-ink-2" style={{ maxHeight }}>
        {code}
      </pre>
    </div>
  );
}
