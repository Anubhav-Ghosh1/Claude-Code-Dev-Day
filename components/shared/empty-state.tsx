import { Inbox } from "lucide-react";

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Inbox size={20} className="text-muted" />
      <div className="text-[13px] text-ink-2">{title}</div>
      {hint && <div className="max-w-xs text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="m-5 rounded-md border border-crit/40 bg-crit/10 px-4 py-3 text-[13px] text-ink-2">
      Couldn&apos;t load data: {error instanceof Error ? error.message : String(error)}
    </div>
  );
}
