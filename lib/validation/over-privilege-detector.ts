import type { PermissionEntry, OverPrivilegeFlag } from '@/types/models';

const HIGH_RISK_SERVICES = new Set(['iam', 'sts', 'organizations', 'kms', 'cloudtrail']);
const ADMIN_ACTIONS = new Set(['*', 'Create*', 'Delete*', 'Put*']);

export function detectOverPrivilege(permissions: PermissionEntry[]): {
  flags: OverPrivilegeFlag[];
  score: number;
} {
  const flags: OverPrivilegeFlag[] = [];
  let riskPoints = 0;

  for (const perm of permissions) {
    if (perm.action === '*' || perm.action.includes('*')) {
      flags.push({
        permission: perm,
        reason: `Wildcard action '${perm.action}' on ${perm.service} — request specific actions instead`,
        severity: perm.action === '*' ? 'critical' : 'warning',
      });
      riskPoints += perm.action === '*' ? 30 : 15;
    }

    if (perm.resource.endsWith(':*') || perm.resource === '*') {
      flags.push({
        permission: perm,
        reason: `Broad resource pattern '${perm.resource}' — narrow to specific resources`,
        severity: perm.resource === '*' ? 'critical' : 'warning',
      });
      riskPoints += perm.resource === '*' ? 30 : 10;
    }

    if (HIGH_RISK_SERVICES.has(perm.service.toLowerCase())) {
      flags.push({
        permission: perm,
        reason: `High-risk service '${perm.service}' — requires elevated review`,
        severity: 'warning',
      });
      riskPoints += 20;
    }

    if (ADMIN_ACTIONS.has(perm.action)) {
      riskPoints += 10;
    }
  }

  const score = Math.min(1, riskPoints / 100);

  return { flags, score };
}
