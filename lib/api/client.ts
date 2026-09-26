import type {
  Agent,
  AnalyticsRange,
  AnalyticsSummary,
  ApiResponse,
  AuditLogFilters,
  AuditLogsResponse,
  Policy,
  RegisterAgentInput,
  RegisterAgentResult,
  Session,
  SessionDetail,
  SessionFilters,
} from "@/types/dashboard";
import { ApiClientError } from "./errors";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new ApiClientError(body.error?.code ?? "HTTP_ERROR", body.error?.message ?? res.statusText, res.status);
  }
  return body as T;
}

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) continue;
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

/** Typed wrappers around the /api/v1 routes the dashboard uses. */
export const api = {
  listSessions: (f: SessionFilters = {}) => http<ApiResponse<Session[]>>(`/sessions${qs(f)}`),
  getSession: (id: string) => http<ApiResponse<SessionDetail>>(`/sessions/${id}`),
  revokeSession: (id: string, reason?: string) =>
    http<ApiResponse<Session>>(`/sessions/${id}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),

  listAuditLogs: (f: AuditLogFilters = {}) => http<AuditLogsResponse>(`/audit-logs${qs(f)}`),
  auditExportUrl: (format: "csv" | "json") => `/api/v1/audit-logs/export${qs({ format })}`,

  getAnalytics: (range: AnalyticsRange) => http<ApiResponse<AnalyticsSummary>>(`/analytics${qs({ range })}`),

  listAgents: () => http<ApiResponse<Agent[]>>(`/agents${qs({ limit: 100 })}`),
  registerAgent: (input: RegisterAgentInput) =>
    http<ApiResponse<RegisterAgentResult>>(`/agents`, { method: "POST", body: JSON.stringify(input) }),
  setAgentStatus: (id: string, status: "suspended" | "revoked") =>
    http<ApiResponse<Agent>>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  listPolicies: () => http<ApiResponse<Policy[]>>(`/policies${qs({ limit: 100 })}`),
};
