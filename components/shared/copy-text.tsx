"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyText({ value, display, className }: { value: string; display?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      title="Copy"
      className={cn("group inline-flex max-w-full cursor-pointer items-center gap-1.5 font-mono text-ink-2 hover:text-ink", className)}
    >
      <span className="truncate">{display ?? value}</span>
      {copied ? <Check size={12} className="shrink-0 text-good" /> : <Copy size={12} className="shrink-0 opacity-0 group-hover:opacity-60" />}
    </button>
  );
}
