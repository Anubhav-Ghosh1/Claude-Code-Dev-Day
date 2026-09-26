"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function HashPreview({ hash, className }: { hash: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      title={open ? "Collapse" : hash}
      className={cn("cursor-pointer font-mono text-[11px] break-all text-muted hover:text-ink-2", className)}
    >
      {open ? hash : `${hash.slice(0, 12)}…`}
    </button>
  );
}
