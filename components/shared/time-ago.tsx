"use client";

import { useNow } from "@/hooks/use-now";
import { fmtDateTime, timeAgo } from "@/lib/utils";

export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const now = useNow(10_000);
  return (
    <time dateTime={iso} title={fmtDateTime(iso)} className={className}>
      {timeAgo(iso, now)}
    </time>
  );
}
