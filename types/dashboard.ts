/**
 * Dashboard read models — the JSON shapes the frontend receives from /api/v1/*.
 *
 * Enums and envelope come from the backend's types/models.ts and types/api.ts,
 * so both sides stay on one source of truth. Dates are ISO strings here
 * because that's what arrives over the wire.
 *
 * Dashboard-specific endpoints: GET /api/v1/analytics, POST /api/v1/sessions/:id/revoke,
 * PATCH /api/v1/agents/:id.
 */
import type {
  ActorType,
  AgentStatus,
  AuditAction,
  AuditSeverity,
  PermissionEntry,
  SessionStatus,
} from "./models";
import type { ApiResponse, PaginationInfo } from "./api";

export type { ActorType, AgentStatus, AuditAction, PermissionEntry, SessionStatus, ApiResponse, PaginationInfo };
export type Severity = AuditSeverity;

// ---------- permissions ----------

export interface DeniedPermission {
  permission: PermissionEntry;
  reason: string;
  policyId?: string;
}

export interface OverPrivilegeFlag {
  permission: PermissionEntry;
  reason: string;
  severity: Severity;
}

// ---------- sessions ----------

export interface Escalation {
  escalationId: string;
  requestedAt: string;
  reason: string;
  requestedPermissions: PermissionEntry[];
  status: "approved" | "partially_approved" | "denied";
  grantedPermissions: PermissionEntry[];
  deniedPermissions: DeniedPermission[];
  evaluatedByPolicy?: string;
  resolvedAt?: string;
}

/** Claude's advisory review of the policy-granted permissions (lib/validation/ai-validator.ts). */
export interface AiValidation {
  approved: boolean;
  reasoning: string;
  flaggedPermissions: { permission: PermissionEntry; concern: string; severity: "low" | "medium" | "high" }[];
  suggestedPermissions?: PermissionEntry[];
  confidenceScore: number; // 0–1
  model?: string;
}

/** The signed-in person an agent acted for (user-level access — see docs/USER_LEVEL_ACCESS.md). */
export interface RequestedBy {
  userId: string;
  email: string;
  name?: string;
  via: "cli" | "dashboard";
}

export interface Session {
  sessionId: string;
  agentId: string;
  requestedBy?: RequestedBy; // absent until the backend ships user-level access
  gist: string;
  status: SessionStatus;
  requestedPermissions: PermissionEntry[];
  grantedPermissions: PermissionEntry[];
  deniedPermissions: DeniedPermission[];
  escalations: Escalation[];
  credentialRef: { tokenId: string; roleArn: string; accessKeyId: string; expiration: string };
  estimatedDuration: number; // seconds
  ttl: { issuedAt: string; expiresAt: string; actualDuration?: number };
  usageCount: number;
  overPrivilegeScore?: number; // 0–1
  overPrivilegeFlags: OverPrivilegeFlag[];
  aiValidation?: AiValidation;
  revokedAt?: string;
  revocationReason?: string;
  createdAt: string;
}

/** GET /api/v1/sessions/:id embeds the session's audit trail. */
export interface SessionDetail extends Session {
  auditTrail: AuditLog[];
}

export interface SessionFilters {
  status?: SessionStatus;
  agentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ---------- audit ----------

export interface AuditLog {
  logId: string;
  sequenceNumber: number;
  sessionId: string | null;
  agentId: string | null;
  actorType: ActorType;
  actorId: string;
  action: AuditAction;
  severity: Severity;
  details: Record<string, unknown>;
  previousHash: string;
  hash: string;
  timestamp: string;
  sourceIp?: string;
  userAgent?: string;
}

export interface ChainIntegrity {
  verified: boolean;
  lastVerifiedAt: string;
  totalEntries: number;
  brokenAt?: number;
  headHash?: string;
  headSequence?: number;
}

export interface AuditLogFilters {
  sessionId?: string;
  agentId?: string;
  action?: AuditAction[];
  severity?: Severity;
  page?: number;
  limit?: number;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  pagination: PaginationInfo;
  chainIntegrity: ChainIntegrity;
}

// ---------- agents ----------

export interface Agent {
  agentId: string;
  name: string;
  description: string;
  apiKeyPrefix: string;
  assignedPolicies: string[];
  metadata: Record<string, string>;
  rateLimit: { maxRequestsPerMinute: number; maxActiveSessions: number };
  status: AgentStatus;
  lastActiveAt: string | null;
  createdAt: string;
  activeSessions?: number;
  totalSessions?: number;
}

export interface RegisterAgentInput {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
  policyIds?: string[];
  rateLimit?: { maxRequestsPerMinute?: number; maxActiveSessions?: number };
}

/** Mirrors RegisterAgentResponse in types/api.ts (dates as strings). */
export interface RegisterAgentResult {
  agentId: string;
  name: string;
  apiKey: string; // shown once
  apiKeyPrefix: string;
  status: "active";
  assignedPolicies: string[];
  rateLimit: { maxRequestsPerMinute: number; maxActiveSessions: number };
  createdAt: string;
  _warning: string;
}

// ---------- policies ----------

export interface PolicyRule {
  effect: "allow" | "deny";
  services: string[];
  actions: string[];
  resources: string[];
  conditions?: Record<string, unknown>;
}

export interface Policy {
  policyId: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  scope: { agentIds: string[]; agentMetadata: Record<string, string> };
  constraints: {
    maxSessionDuration: number;
    maxEscalationsPerSession: number;
    maxConcurrentSessions: number;
    allowedRegions: string[];
  };
  priority: number;
  status: "active" | "disabled";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionInput {
  agentId: string;
  gist: string;
  permissions: PermissionEntry[];
  estimatedDuration: number;
}

export interface DashboardSessionResult {
  sessionId: string;
  status: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
    region: string;
  };
  grantedPermissions: PermissionEntry[];
  deniedPermissions: DeniedPermission[];
  overPrivilegeFlags: OverPrivilegeFlag[];
  aiValidation?: AiValidation;
  _mock?: boolean;
  ttl: { issuedAt: string; expiresAt: string; durationSeconds: number };
}

export interface CreatePolicyInput {
  name: string;
  description?: string;
  rules: PolicyRule[];
  scope?: { agentIds?: string[]; agentMetadata?: Record<string, string> };
  constraints?: {
    maxSessionDuration?: number;
    maxEscalationsPerSession?: number;
    maxConcurrentSessions?: number;
    allowedRegions?: string[];
  };
  priority?: number;
}

// ---------- analytics ----------

export type AnalyticsRange = "24h" | "7d" | "14d";

export interface Kpi {
  value: number;
  previous: number; // same metric over the preceding period
  spark: number[]; // one point per timeseries bucket
}

export interface AnalyticsSummary {
  range: AnalyticsRange;
  generatedAt: string;
  bucketSeconds: number;
  kpis: {
    activeSessions: Kpi;
    tokensIssued: Kpi;
    denialRate: Kpi; // 0–1
    avgTokenLifetime: Kpi & { avgGrantedSeconds: number }; // seconds
    criticalEvents: Kpi;
  };
  timeseries: { bucketStart: string; granted: number; denied: number }[];
  /** Policy hard-blocks vs permissions Claude flagged as unnecessary (advisory). */
  bySource: { policy: number; aiFlagged: number };
  byService: { service: string; granted: number; denied: number }[];
  riskBuckets: { label: string; min: number; max: number; count: number }[];
  topDenied: { service: string; action: string; count: number; topReason: string }[];
  agents: {
    agentId: string;
    name: string;
    status: AgentStatus;
    sessions: number;
    denialRate: number;
    violations: number;
  }[];
}

// ---------- CLI sign-in (device authorization) ----------

/** Shown on /dashboard/cli/authorize so the user can confirm which terminal they're approving. */
export interface CliDeviceRequest {
  userCode: string; // e.g. "WDJB-MJHT", also printed in the terminal
  clientName: string; // e.g. "agentvault-cli 0.1 on arun-mbp"
  requestedAt: string;
  expiresAt: string;
}
