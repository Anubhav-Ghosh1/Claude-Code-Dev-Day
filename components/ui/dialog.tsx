"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Native <dialog>: focus trap, Esc and backdrop come for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      style={{ width }}
      className="m-auto max-w-[calc(100vw-2rem)] rounded-lg border border-line-strong bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="animate-rise">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-medium">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded p-1 text-muted hover:bg-raised hover:text-ink">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
