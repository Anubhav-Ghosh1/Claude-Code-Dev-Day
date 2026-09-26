"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAgents, useAuditLogs } from "@/hooks/use-api";
import { Card, CardHeader } from "@/components/ui/card";
import { LiveDot, SeverityIcon } from "@/components/shared/status";
import { TimeAgo } from "@/components/shared/time-ago";
import { Skeleton } from "@/components/ui/skeleton";
import { describeEvent } from "@/lib/describe-event";
import { cn } from "@/lib/utils";

export function LiveActivityFeed({ limit = 14, className }: { limit?: number; className?: string }) {
  const { data } = useAuditLogs({ limit });
  const { data: agents } = useAgents();
  const names = useMemo(() => new Map(agents?.map((a) => [a.agentId, a.name])), [agents]);

  // Entries present on first load don't flash; anything newer flashes once on mount.
  const [initial, setInitial] = useState<Set<string> | null>(null);
  if (data && !initial) setInitial(new Set(data.data.map((e) => e.logId)));

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader
        eyebrow="Audit stream"
        title={
          <span className="flex items-center gap-2">
            Live activity <LiveDot className="text-good" />
          </span>
        }
        actions={<Link href="/dashboard/audit" className="text-[12px] text-muted hover:text-ink-2">Full log →</Link>}
      />
      <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
        {!data &&
          Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="px-5 py-3">
              <Skeleton className="h-4 w-full" />
            </li>
          ))}
        {data?.data.map((e) => {
          const body = (
            <>
              <span className="mt-0.5">
                <SeverityIcon severity={e.severity} size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[12.5px] leading-snug text-ink-2">{describeEvent(e, e.agentId ? names.get(e.agentId) : undefined)}</div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-muted">
                  <span className="tabular">#{e.sequenceNumber}</span>
                  <span>{e.action}</span>
                  <TimeAgo iso={e.timestamp} className="ml-auto shrink-0" />
                </div>
              </div>
            </>
          );
          const cls = cn("flex gap-3 px-5 py-2.5", initial && !initial.has(e.logId) && "flash-in");
          return (
            <li key={e.logId}>
              {e.sessionId ? (
                <Link href={`/dashboard/sessions/${e.sessionId}`} className={cn(cls, "hover:bg-raised/40")}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
