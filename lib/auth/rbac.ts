import type { UserRole } from '@/types/models';

const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  admin: new Set([
    'agents.read', 'agents.write',
    'sessions.read', 'sessions.revoke',
    'policies.read', 'policies.write',
    'audit.read', 'audit.export',
    'settings.read', 'settings.write',
  ]),
  auditor: new Set([
    'agents.read',
    'sessions.read',
    'policies.read',
    'audit.read', 'audit.export',
  ]),
  viewer: new Set([
    'agents.read',
    'sessions.read',
  ]),
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function requirePermission(role: UserRole, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role '${role}' lacks permission '${permission}'`);
  }
}
