import type { PermissionEntry } from "@/types/dashboard";
import { shortArn } from "@/lib/utils";
import { ServiceIcon } from "./service-icon";

export function PermissionLabel({ permission }: { permission: PermissionEntry }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ServiceIcon service={permission.service} />
      <div className="min-w-0">
        <div className="font-mono text-[12.5px] text-ink">
          <span className="text-muted">{permission.service}:</span>
          {permission.action}
        </div>
        <div className="truncate font-mono text-[11px] text-muted" title={permission.resource}>
          {shortArn(permission.resource)}
        </div>
      </div>
    </div>
  );
}
