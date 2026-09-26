import type { PermissionEntry, DeniedPermission, OverPrivilegeFlag, Escalation, TTLInfo } from './models';

// Request types
export interface CreateSessionRequest {
  gist: string;
  permissions: PermissionEntry[];
  estimatedDuration: number;
}

export interface EscalateSessionRequest {
  additionalPermissions: PermissionEntry[];
  reason: string;
}

export interface CompleteSessionRequest {
  summary?: string;
}

export interface RegisterAgentRequest {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
  policyIds?: string[];
  rateLimit?: {
    maxRequestsPerMinute?: number;
    maxActiveSessions?: number;
  };
}

export interface CreatePolicyRequest {
  name: string;
  description?: string;
  rules: PolicyRuleInput[];
  scope?: {
    agentIds?: string[];
    agentMetadata?: Record<string, string>;
  };
  constraints?: {
    maxSessionDuration?: number;
    maxEscalationsPerSession?: number;
    maxConcurrentSessions?: number;
    allowedRegions?: string[];
  };
  priority?: number;
}

export interface PolicyRuleInput {
  effect: 'allow' | 'deny';
  services: string[];
  actions: string[];
  resources: string[];
  conditions?: Record<string, unknown>;
}

// Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SessionCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  region: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  status: 'active';
  credentials: SessionCredentials;
  grantedPermissions: PermissionEntry[];
  deniedPermissions: DeniedPermission[];
  overPrivilegeFlags: OverPrivilegeFlag[];
  ttl: TTLInfo;
}

export interface EscalateSessionResponse {
  sessionId: string;
  status: 'active';
  escalation: {
    escalationId: string;
    status: Escalation['status'];
    requestedPermissions: PermissionEntry[];
    grantedPermissions: PermissionEntry[];
    deniedPermissions: DeniedPermission[];
    resolvedAt: string;
  };
  credentials: SessionCredentials;
  allGrantedPermissions: PermissionEntry[];
  ttl: TTLInfo;
  totalEscalations: number;
  remainingEscalations: number;
}

export interface RegisterAgentResponse {
  agentId: string;
  name: string;
  apiKey: string;
  apiKeyPrefix: string;
  status: 'active';
  assignedPolicies: string[];
  rateLimit: {
    maxRequestsPerMinute: number;
    maxActiveSessions: number;
  };
  createdAt: string;
  _warning: string;
}

// Query params
export interface SessionListQuery {
  status?: string;
  agentId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: string;
  limit?: string;
  sort?: string;
}

export interface AuditLogQuery {
  sessionId?: string;
  agentId?: string;
  action?: string;
  severity?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}
