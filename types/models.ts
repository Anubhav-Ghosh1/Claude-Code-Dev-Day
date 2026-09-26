export interface PermissionEntry {
  service: string;
  action: string;
  resource: string;
  effect: 'Allow' | 'Deny';
  conditions?: Record<string, unknown>;
}

export interface DeniedPermission {
  permission: PermissionEntry;
  reason: string;
  policyId?: string;
}

export interface Escalation {
  escalationId: string;
  requestedAt: Date;
  reason: string;
  requestedPermissions: PermissionEntry[];
  status: 'approved' | 'partially_approved' | 'denied';
  grantedPermissions: PermissionEntry[];
  deniedPermissions: DeniedPermission[];
  evaluatedByPolicy?: string;
  resolvedAt?: Date;
}

export interface OverPrivilegeFlag {
  permission: PermissionEntry;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface CredentialRef {
  tokenId: string;
  roleArn: string;
  accessKeyId: string;
  expiration: Date;
}

export interface TTLInfo {
  issuedAt: Date;
  expiresAt: Date;
  actualDuration?: number;
}

export type AgentStatus = 'active' | 'suspended' | 'revoked';
export type SessionStatus = 'active' | 'completed' | 'revoked' | 'expired';
export type TokenStatus = 'active' | 'revoked' | 'expired';
export type PolicyStatus = 'active' | 'disabled';
export type ActorType = 'agent' | 'system' | 'dashboard_user';
export type AuditSeverity = 'info' | 'warning' | 'critical';
export type UserRole = 'admin' | 'auditor' | 'viewer';

export type AuditAction =
  | 'agent.registered'
  | 'agent.suspended'
  | 'agent.revoked'
  | 'session.created'
  | 'session.completed'
  | 'session.revoked'
  | 'session.expired'
  | 'credentials.issued'
  | 'credentials.rotated'
  | 'credentials.revoked'
  | 'escalation.requested'
  | 'escalation.approved'
  | 'escalation.partially_approved'
  | 'escalation.denied'
  | 'permission.granted'
  | 'permission.denied'
  | 'policy.created'
  | 'policy.updated'
  | 'policy.disabled'
  | 'policy.violated'
  | 'overprivilege.detected'
  | 'integrity.check.passed'
  | 'integrity.check.failed';
