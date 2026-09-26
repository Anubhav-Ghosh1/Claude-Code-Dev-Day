import { Check, X } from "lucide-react";
import type { DeniedPermission, PermissionEntry, Session } from "@/types/dashboard";
import { Card, CardHeader } from "@/components/ui/card";
import { PermissionLabel } from "@/components/shared/permission";

function Row({ permission, denial, tag }: { permission: PermissionEntry; denial?: DeniedPermission; tag?: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-6 px-5 py-3">
      <PermissionLabel permission={permission} />
      <div className="flex items-start gap-2.5 text-[12.5px]">
        {denial ? <X size={15} className="mt-0.5 shrink-0 text-crit" /> : <Check size={15} className="mt-0.5 shrink-0 text-good" />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-ink">
            {denial ? "Denied" : "Granted"}
            {denial && (
              <span className="rounded border border-line-strong px-1.5 font-mono text-[10.5px] text-ink-2">
                {denial.policyId ?? "no allow policy"}
              </span>
            )}
            {tag && <span className="rounded bg-raised px-1.5 font-mono text-[10.5px] text-muted">{tag}</span>}
          </div>
          {denial && <div className="mt-0.5 text-muted">{denial.reason}</div>}
        </div>
      </div>
    </li>
  );
}

export function PermissionsDiff({ session }: { session: Session }) {
  const denialFor = (p: PermissionEntry, list: DeniedPermission[]) =>
    list.find((d) => d.permission.service === p.service && d.permission.action === p.action && d.permission.resource === p.resource);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          eyebrow="Initial request"
          title={`${session.requestedPermissions.length} requested → ${session.grantedPermissions.length} granted`}
        />
        <ul className="divide-y divide-line border-t border-line">
          {session.requestedPermissions.map((p, i) => (
            <Row key={i} permission={p} denial={denialFor(p, session.deniedPermissions)} />
          ))}
        </ul>
      </Card>
      {session.escalations.length > 0 && (
        <Card>
          <CardHeader eyebrow="Mid-task" title="Escalated permissions" />
          <ul className="divide-y divide-line border-t border-line">
            {session.escalations.flatMap((e) =>
              e.requestedPermissions.map((p, i) => <Row key={`${e.escalationId}-${i}`} permission={p} denial={denialFor(p, e.deniedPermissions)} tag={e.escalationId} />),
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
