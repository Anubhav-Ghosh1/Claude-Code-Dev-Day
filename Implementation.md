AgentVault — Architecture & Implementation Plan
Sep 26, 2026 · @Anubhav Ghosh
Least-privilege credential provisioning platform for AI agents. Agents declare intent + required AWS permissions, server validates against policies, issues scoped time-bound credentials via STS, logs everything with hash-chained immutable audit trail. Built for enterprise compliance (SOC 2).
Stack: Next.js 14 (App Router) + TypeScript + Tailwind CSS + MongoDB + AWS STS
Architecture Overview
The platform sits between AI agents and cloud providers. Agents never touch raw credentials — they declare what they need, the server validates and brokers scoped access.
Core Flow
1. Agent plans — declares feature gist + required AWS permissions (service, action, resource ARN)
2. Server validates — evaluates request against policies (deny-first), flags over-privilege (This will be the ai agent using claude api call we will do it)
3. Server issues credentials — calls AWS STS AssumeRole with inline session policy scoped to only granted permissions
4. Agent executes — uses time-bound scoped credentials (effective permissions = target role ∩ inline policy)
5. Agent escalates (if needed) — requests additional permissions mid-task, server re-evaluates and issues new credentials
6. Agent completes — calls completion endpoint, credentials invalidated, session finalized
7. Everything logged — hash-chained immutable audit trail for every permission decision
System Components
Component
Responsibility
API Layer (Next.js API Routes)
Agent auth, request routing, rate limiting
Permission Validator
Evaluate requested permissions against policies, deny-first logic, ARN pattern matching
Over-Privilege Detector
Flag wildcard actions, broad resources, admin-level access; compute risk score (0–1)
Credential Broker
AWS STS AssumeRole with inline session policy, credential encryption at rest
Audit Logger
Hash-chained immutable log entries with atomic sequence numbering
Policy Engine
CRUD for permission policies with rules, scopes, constraints, priority
Dashboard
Real-time session monitoring, permission diffs, escalation timelines, audit viewer
Data Flow
Direction
Path
Agent → Server
X-API-Key auth → POST /sessions with gist + permissions
Server → AWS
STS AssumeRole (Broker Role → Target Role + inline policy)
Server → Agent
Scoped credentials + TTL + granted/denied permissions
Server → MongoDB
Session record + encrypted token + audit log entries
Dashboard → Server
NextAuth JWT auth → GET /sessions, /audit-logs (polls every 5s for active sessions)
Project Structure
Monorepo-style Next.js App Router layout. API routes under /app/api/v1/, dashboard pages under /app/dashboard/, shared logic in /lib/.
agent-vault/
├── app/
│   ├── layout.tsx                        # Root layout (providers, fonts)
│   ├── page.tsx                          # Landing → redirect to dashboard
│   ├── api/v1/
│   │   ├── agents/route.ts              # POST (register), GET (list)
│   │   ├── sessions/
│   │   │   ├── route.ts                 # POST (create), GET (list)
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET (detail)
│   │   │       ├── escalate/route.ts    # POST
│   │   │       └── complete/route.ts    # POST
│   │   ├── audit-logs/
│   │   │   ├── route.ts                 # GET (list with filters)
│   │   │   └── export/route.ts          # GET (CSV/JSON export)
│   │   ├── policies/
│   │   │   ├── route.ts                 # GET, POST
│   │   │   └── [id]/route.ts            # GET, PUT, DELETE
│   │   └── health/route.ts              # GET
│   ├── auth/signin/page.tsx              # Custom sign-in
│   └── dashboard/
│       ├── layout.tsx                    # Shell: sidebar + topbar + auth guard
│       ├── page.tsx                      # Overview / stats
│       ├── sessions/
│       │   ├── page.tsx                  # Sessions list
│       │   └── [id]/page.tsx             # Session detail (4 tabs)
│       ├── audit/page.tsx                # Audit log viewer
│       ├── policies/page.tsx             # Policy management
│       ├── agents/page.tsx               # Agents management
│       └── settings/page.tsx             # System settings
├── components/
│   ├── ui/                               # button, badge, card, dialog, data-table, tabs, etc.
│   ├── layout/                           # sidebar, topbar, nav-link
│   ├── sessions/                         # sessions-table, permissions-diff, escalation-timeline
│   ├── audit/                            # audit-log-table, audit-filters, export-button
│   ├── policies/                         # policies-table, policy-editor, rule-builder
│   ├── agents/                           # agents-table, register-dialog, api-key-reveal
│   └── shared/                           # time-ago, json-viewer, empty-state
├── lib/
│   ├── db/
│   │   ├── connection.ts                 # Mongoose singleton
│   │   └── models/                       # agent, session, audit-log, policy, token
│   ├── aws/
│   │   ├── sts-client.ts                 # STS client singleton
│   │   ├── credential-broker.ts          # AssumeRole + inline policy
│   │   ├── policy-document-builder.ts    # Permissions → IAM policy JSON
│   │   └── arn-validator.ts              # ARN parsing and validation
│   ├── auth/
│   │   ├── next-auth-options.ts          # NextAuth configuration
│   │   ├── api-key-auth.ts               # Agent API key validation
│   │   └── rbac.ts                       # Role-based access (admin/auditor/viewer)
│   ├── validation/
│   │   ├── schemas.ts                    # Zod schemas for all API inputs
│   │   ├── permission-validator.ts       # Evaluate permissions against policies
│   │   └── over-privilege-detector.ts    # Flag wildcard/admin/broad perms
│   ├── audit/
│   │   ├── logger.ts                     # Core audit write function
│   │   ├── hash-chain.ts                 # SHA-256 chain computation
│   │   └── integrity-checker.ts          # Verify chain integrity
│   ├── crypto/
│   │   ├── encryption.ts                 # AES-256-GCM for creds at rest
│   │   └── api-key-generator.ts          # Secure API key generation
│   ├── rate-limit/limiter.ts             # Per-agent rate limiting
│   ├── errors/api-errors.ts              # Structured error classes
│   └── utils/                            # response, pagination, constants
├── hooks/                                # use-sessions, use-audit-logs, use-polling
├── types/                                # api.ts, models.ts, aws.ts, dashboard.ts
├── middleware.ts                          # Route protection
└── scripts/                              # seed-policies, verify-audit-chain
MongoDB Schema Designs
Five collections. All use prefixed nanoid for primary keys (agt_, sess_, alog_, pol_, tok_). Audit logs enforce immutability via Mongoose pre-hooks blocking update/delete.
agents
Field
Type
Notes
agentId
string (unique, indexed)
agt_ + nanoid(16)
name
string
max 128 chars
description
string
max 512
apiKeyHash
string
bcrypt hash (cost 12)
apiKeyPrefix
string (indexed)
first 12 chars of key, for fast lookup
assignedPolicies
ObjectId[]
refs to Policy collection
metadata
Mixed
arbitrary: team, environment, owner
rateLimit.maxRequestsPerMinute
number
default 30
rateLimit.maxActiveSessions
number
default 5
status
enum: active/suspended/revoked
indexed
lastActiveAt
Date

createdBy
string
dashboard user ID
sessions
Field
Type
Notes
sessionId
string (unique, indexed)
sess_ + nanoid(20)
agentId
string (indexed)
ref Agent
gist
string
max 4096 — what agent is building
status
enum: active/completed/revoked/expired
indexed
requestedPermissions
PermissionEntry[]
service, action, resource, effect, conditions
grantedPermissions
PermissionEntry[]
subset of requested
deniedPermissions
[{permission, reason, policyId}]
with denial reasons
escalations
Escalation[]
id, reason, requested/granted/denied, status, resolvedAt
credentialRef
{tokenId, roleArn, accessKeyId, expiration}
no secrets stored here
estimatedDuration
number
seconds, max 43200 (12h)
ttl.issuedAt
Date

ttl.expiresAt
Date (indexed)

ttl.actualDuration
number
filled on complete
usageCount
number
default 0
overPrivilegeScore
number
0.0–1.0
overPrivilegeFlags
[{permission, reason, severity}]
info/warning/critical
PermissionEntry: {service, action, resource, effect: Allow|Deny, conditions?}
Escalation: {escalationId, requestedAt, reason, requestedPermissions[], status: approved|partially_approved|denied, grantedPermissions[], deniedPermissions[], evaluatedByPolicy, resolvedAt}
audit_logs (IMMUTABLE)
Field
Type
Notes
logId
string (unique)
alog_ + nanoid(24)
sequenceNumber
number (unique)
monotonically increasing
sessionId
string (indexed)
nullable for non-session events
agentId
string (indexed)

actorType
enum: agent/system/dashboard_user

actorId
string
agentId, "system", or dashboard userId
action
enum
session.created, credentials.issued, escalation.requested, permission.denied, etc.
severity
enum: info/warning/critical
indexed
details
Mixed
action-specific payload
previousHash
string
SHA-256 of preceding entry
hash
string (unique)
SHA-256(previousHash + logId + seq + action + timestamp + sorted(details))
timestamp
Date (indexed)

sourceIp
string

userAgent
string

Immutability enforced via: Mongoose pre-hooks blocking update/delete/findOneAndUpdate/findOneAndDelete, no mutation API endpoints, hash chain tamper detection, MongoDB user-level deny on update/remove.
policies
Field
Type
Notes
policyId
string (unique)
pol_ + nanoid(12)
name
string
max 128
description
string
max 1024
rules
PolicyRule[]
effect (allow/deny), services[], actions[], resources[] (ARN patterns), conditions
scope.agentIds
string[]
empty = applies to all agents
scope.agentMetadata
Map<string, string>
match by metadata key-value
constraints.maxSessionDuration
number
seconds, default 3600
constraints.maxEscalationsPerSession
number
default 3
constraints.maxConcurrentSessions
number
default 5
constraints.allowedRegions
string[]
AWS regions
priority
number
higher wins; deny wins at equal priority
status
enum: active/disabled

version
number
incremented on update
tokens
Field
Type
Notes
tokenId
string (unique)
tok_ + nanoid(16)
sessionId
string (indexed)
ref Session
agentId
string (indexed)

accessKeyId
string (indexed)
AWS access key ID (not secret)
encryptedSecretKey
string
AES-256-GCM encrypted
encryptedSessionToken
string
AES-256-GCM encrypted
iv
string
initialization vector
authTag
string
GCM authentication tag
encryptionKeyId
string
for key rotation
roleArn
string

inlinePolicy
Mixed
IAM policy doc applied
status
enum: active/revoked/expired
indexed
issuedAt
Date

expiresAt
Date
TTL index: auto-delete 30 days after expiry
revokedAt
Date

supersededBy
string
tokenId of replacement (after escalation)
API Contracts
All agent-facing endpoints authenticate via X-API-Key header. Dashboard endpoints authenticate via NextAuth JWT session cookie. All responses use a consistent envelope: { data, error?, pagination? }.
POST /api/v1/sessions — Create Credential Session
Auth: X-API-Key
Request:
{
  "gist": "Deploy user-service Lambda with DynamoDB table for user profiles",
  "permissions": [
    { "service": "lambda", "action": "CreateFunction", "resource": "arn:aws:lambda:us-east-1:123456789012:function:user-service-*" },
    { "service": "dynamodb", "action": "CreateTable", "resource": "arn:aws:dynamodb:us-east-1:123456789012:table/user-profiles" },
    { "service": "dynamodb", "action": "DescribeTable", "resource": "arn:aws:dynamodb:us-east-1:123456789012:table/user-profiles" }
  ],
  "estimatedDuration": 3600
}
Response (201):
{
  "sessionId": "sess_m3Kx9pQvR7tW2jN5bL8y",
  "status": "active",
  "credentials": {
    "accessKeyId": "ASIAXXX...",
    "secretAccessKey": "wJalr...",
    "sessionToken": "FwoGZX...",
    "expiration": "2024-01-15T11:00:00.000Z",
    "region": "us-east-1"
  },
  "grantedPermissions": [...],
  "deniedPermissions": [{ "service": "iam", "action": "PassRole", "reason": "Denied by pol_security_baseline" }],
  "overPrivilegeFlags": [],
  "ttl": { "issuedAt": "...", "expiresAt": "...", "durationSeconds": 3600 }
}
Processing: Auth agent → rate limit check → validate ARNs (Zod) → load applicable policies → evaluate deny-first → build IAM inline policy → STS AssumeRole → encrypt and store creds → create session → write audit logs → respond.
Errors: 400 (invalid ARN/missing fields), 401 (bad key), 403 (agent suspended/all denied), 429 (rate limit/max sessions)
POST /api/v1/sessions/[id]/escalate — Request Additional Permissions
Auth: X-API-Key (must own session)
Request:
{
  "additionalPermissions": [
    { "service": "s3", "action": "PutObject", "resource": "arn:aws:s3:::deploy-artifacts/*" }
  ],
  "reason": "Need S3 for Lambda deployment package — exceeds direct upload limit"
}
Response (200): New credentials (old revoked), escalation details (requested/granted/denied), updated allGrantedPermissions, remainingEscalations count, new TTL.
Processing: Verify session active + owned → check escalation limit → validate new perms against policies → revoke old STS creds → AssumeRole with combined policy (original + escalated) → store new token (mark old as superseded) → audit log.
Errors: 400 (invalid perms), 403 (wrong agent/all denied), 404 (session not found), 409 (session not active), 429 (max escalations)
POST /api/v1/sessions/[id]/complete — Finalize Session
Auth: X-API-Key (must own session)
Request (optional body):
{ "summary": "Successfully deployed Lambda + DynamoDB table" }
Response (200): Session summary — duration, permission counts (requested/granted/denied), escalation count, all credentials confirmed revoked.
GET /api/v1/sessions — List Sessions
Auth: Dashboard (NextAuth) or X-API-Key (agent sees only own sessions)
Query params: status, agentId, from, to (ISO 8601 date range), search (full-text on gist), page, limit (default 25), sort (default -createdAt)
GET /api/v1/sessions/[id] — Session Detail
Full session with all escalations, permission diffs, credential refs (no secrets), audit chain head.
GET /api/v1/audit-logs — Compliance Audit Log
Auth: Dashboard with admin or auditor role
Query params: sessionId, agentId, action (comma-separated), severity, from, to, page, limit
Response includes chainIntegrity verification status.
GET /api/v1/audit-logs/export — Streamed Export
Same filters + format param (json or csv). Returns streamed file download.
POST /api/v1/agents — Register Agent
Auth: Dashboard with admin role
Request:
{
  "name": "infra-deploy-agent",
  "description": "Deploys infrastructure for the platform team",
  "metadata": { "team": "platform", "environment": "staging" },
  "policyIds": ["pol_abc123def456"],
  "rateLimit": { "maxRequestsPerMinute": 20, "maxActiveSessions": 3 }
}
Response (201): agentId, API key (shown once, never again), prefix, status. Warning to store key securely.
POST/GET /api/v1/policies — Policy CRUD
Standard create/list/get/update. Updates increment version. All changes audit-logged.
GET /api/v1/health
Returns MongoDB connectivity status, AWS STS reachability, app version.
AWS STS Integration
The platform acts as a credential broker. It never stores permanent AWS credentials for agent workloads — it assumes a Broker Role and issues scoped temporary credentials via STS.
Broker Model
Effective permissions = Target Role permissions ∩ Inline Session Policy
Three IAM roles in play:
Role
Purpose
AgentVaultBroker
Platform’s own role. Can only call sts:AssumeRole on AgentWorkload-* roles
AgentWorkload-Staging
Maximum permission boundary for staging agent work
AgentWorkload-Production
Maximum permission boundary for production agent work
The Broker assumes a Target role and passes an inline session policy that further restricts credentials to only the specific actions/resources the agent requested and policies approved.
Credential Issuance Flow
1. Permission Validator produces grantedPermissions[]
2. Policy Document Builder converts to IAM policy JSON: {Version, Statement: [{Effect: Allow, Action: ["lambda:CreateFunction", ...], Resource: ["arn:..."]}]}
3. STS AssumeRole call with: RoleArn (target), RoleSessionName (session ID), Policy (inline), DurationSeconds (TTL), Tags (agentId, sessionId)
4. Returns AccessKeyId, SecretAccessKey, SessionToken, Expiration
5. Secret key + session token encrypted with AES-256-GCM before storage
Revocation Strategy
STS temporary credentials cannot be individually revoked via the STS API. Three-layer approach:
Layer
Mechanism
When
Short TTLs (primary)
Issue 15 min to 1 hour credentials
Always
Session Tag Deny Policy (emergency)
Attach inline deny to target role matching aws:PrincipalTag/sessionId
Admin-triggered revocation
Completion Marking (advisory)
Mark token revoked in DB, reject further API calls from agent
Session complete/revoke
Key Constraint
STS inline policy max size is 2048 characters (packed JSON). Mitigations:
• Group permissions by service into fewer Statement blocks
• If exceeded: warn agent, suggest narrowing resource patterns
• Use target role’s attached policies as the broad boundary, inline policy as the scoping mechanism
Required IAM Setup (for deployers)
Broker Role trust policy: allow ECS tasks (or EC2) to assume it. Permissions: sts:AssumeRole on arn:aws:iam::ACCOUNT:role/AgentWorkload-* + sts:TagSession.
Target Roles trust policy: allow Broker role to assume, with sts:ExternalId condition agentvault-broker.
Environment Variables
Variable
Purpose
AWS_REGION
Default region
AWS_TARGET_ROLE_ARN
Target role for credential issuance
AWS_EXTERNAL_ID
External ID for AssumeRole
MONGODB_URI
MongoDB connection string
NEXTAUTH_SECRET
NextAuth JWT signing key
CREDENTIAL_ENCRYPTION_KEY
32-byte base64 key for AES-256-GCM
API_KEY_BCRYPT_ROUNDS
bcrypt cost factor (default 12)
DEFAULT_SESSION_TTL
Default TTL in seconds (default 3600)
MAX_SESSION_TTL
Maximum TTL in seconds (default 43200)
Dashboard Pages
All pages share a dashboard layout: collapsible sidebar (nav links + user menu) + topbar (breadcrumbs, active sessions indicator, notification bell). Real-time via SWR polling (5s interval when active sessions exist).
Overview (/dashboard)
• Stat cards row: Active Sessions (count + trend), Sessions Today, Permissions Denied (severity-colored), Escalations
• Recent sessions table: Last 10 sessions — agent name, gist preview (80 chars), status badge, time ago
• Critical alerts panel: Recent warning and critical audit entries
Sessions List (/dashboard/sessions)
• Filters bar: Status dropdown (All/Active/Completed/Revoked/Expired), Agent selector (searchable), Date range picker, Gist search input
• Table columns: Status badge (colored dot), Agent tag, Gist preview, Permission count ("3 granted / 1 denied"), Escalation badge (if > 0), TTL progress bar (visual time elapsed vs total), Created timestamp
• Interactions: Click row → detail page. Pagination. Polls for live status updates.
Session Detail (/dashboard/sessions/[id]) — 4 Tabs
Header: Back button, Session ID (mono), Status badge (large), Agent tag, Revoke button (if active, with confirmation dialog), Export button
Tab 1 — Overview:
• Gist card (full text, styled as quote block)
• TTL info card: issued at, expires at, actual duration (if completed), progress bar, live countdown (if active)
• Usage stats: credential sets issued, escalation count, over-privilege score gauge
• Over-privilege flags card (if any): yellow/red warnings with reasons
Tab 2 — Permissions:
• Requested permissions list: each row shows service icon, action label, resource ARN (mono, truncated with tooltip), status badge (green check Granted / red X Denied with reason tooltip)
• Escalated permissions section: tagged with escalation ID
Tab 3 — Escalations:
• Vertical timeline: Session Created (initial perms) → Escalation #1 (timestamp, reason, requested/granted/denied, status badge) → ... → Session Completed/Revoked/Expired
Tab 4 — Audit Trail:
• Chronological audit entries for this session: timestamp, action badge (color-coded), human-readable description, hash preview (first 12 chars, click to expand), expand button (full details JSON)
• Chain integrity badge at bottom
Audit Logs (/dashboard/audit)
• Chain integrity banner: Green check "Verified" or red alert "INTEGRITY VIOLATION DETECTED" with last verified timestamp
• Filters: Agent, Action type (multi-select), Severity (info/warning/critical), Date range, Session ID search
• Table: Sequence number, Timestamp, Severity dot (green/yellow/red), Action badge, Actor info (agent name or "System"), Session link (clickable), Description preview, Expand button
• Expanded row: Full details JSON viewer, Hash info (previousHash → hash), Source info (IP, user agent)
• Export button: JSON or CSV download
Policies (/dashboard/policies)
• Table: Policy name, Description (truncated), Rule count, Scope info ("All agents" or "3 specific agents"), Status badge, Priority, Version, Actions (Edit, Disable, Clone)
• Editor (slide-over panel): Name, Description, Rules builder (Effect toggle Allow/Deny, Services tags, Actions tags, Resources ARN patterns with validation, Conditions JSON editor), Scope (agent multi-select, metadata match), Constraints (max session duration, max escalations, allowed regions), Priority, Save/Cancel
Agents (/dashboard/agents)
• Table: Agent name, Agent ID (mono), API key prefix, Status badge, Assigned policies count, Active sessions count, Last active, Actions (Edit, Suspend, Revoke, Rotate Key)
• Register dialog: Name, Description, Metadata (key-value pairs), Policy selector (multi-select), Rate limit inputs
• API Key Reveal (after registration): Warning banner ("Copy now, won’t show again"), Key display (mono + copy button), Done button
Authentication & Audit
Agent Authentication (API Key)
Key format: avk_live_ + 32 random bytes (base62). Example: avk_live_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ
Generation (during agent registration):
1. crypto.randomBytes(32) → base62 encode → prepend avk_live_ (or avk_test_)
2. Hash full key with bcrypt (cost 12), store hash
3. Store first 12 chars as apiKeyPrefix for fast lookup
4. Return plaintext key exactly once
Request flow:
1. Extract X-API-Key header
2. Extract 12-char prefix → query Agent.findOne({ apiKeyPrefix, status: 'active' })
3. bcrypt.compare(providedKey, agent.apiKeyHash)
4. Match → attach agent to request context. No match → 401.
5. Check rate limits before handler.
Implemented in lib/auth/api-key-auth.ts — called at top of every /api/v1/sessions* route (not middleware, because Next.js middleware runs on Edge which doesn’t support Mongoose).
Dashboard Authentication (NextAuth.js)
Strategy: JWT (stateless). Credentials provider initially (swap to OAuth/SAML for enterprise).
Roles:
Role
Access
admin
Full access: register agents, manage policies, revoke sessions, export audit logs
auditor
Read-only everything: sessions, audit logs, policies, agents. Can export. Cannot create/modify
viewer
Sessions and agents only. No audit logs or policies
Route protection: middleware.ts checks path — /dashboard/* requires NextAuth session (redirect to /auth/signin if missing). /api/v1/* passes through (uses API key auth per handler). Individual pages check role via getServerSession().
Audit Logging — Hash Chain
Hash function: SHA-256. Each entry chained to predecessor for tamper detection.
Genesis: First entry uses previousHash = SHA256("AgentVault-AuditLog-Genesis-v1") (constant in codebase).
Hash computation: SHA256(previousHash + logId + sequenceNumber + action + timestamp.toISOString() + JSON.stringify(sortedDetails))
sortedDetails uses deterministic JSON serialization (keys sorted alphabetically) for consistent hashes.
Concurrency handling: Atomic counter via MongoDB findOneAndUpdate on a counters collection:
1. Atomically increment seq + get current chain head
2. Compute hash with the retrieved previousHash
3. Insert audit log entry
4. Update counter with new hash head (compare-and-swap with retry, max 3)
What Gets Logged
Trigger
Action
Severity
Agent registered
agent.registered
info
Agent suspended/revoked
agent.suspended / agent.revoked
warning
Session created
session.created + credentials.issued + any permission.denied
info (denied = warning)
Escalation requested
escalation.requested + outcome
info (denied = warning)
Session completed
session.completed + credentials.revoked
info
Session revoked by admin
session.revoked + credentials.revoked
warning
Session expired (TTL)
session.expired + credentials.revoked
info
Policy created/updated
policy.created / policy.updated
info
Over-privilege detected
overprivilege.detected
warning/critical
Chain integrity check
integrity.check.passed / .failed
info/critical
Immutability Enforcement (5 layers)
1. Mongoose pre-hooks: Block all update/delete/findOneAndUpdate/findOneAndDelete
2. No API endpoints: No PUT/PATCH/DELETE routes for audit logs
3. Hash chain: Any modification breaks the chain, detectable by integrity checker
4. Periodic verification: Background job runs verifyChainIntegrity() and writes result to audit log
5. MongoDB user permissions: DB user denies update and remove on audit_logs collection
SOC 2 Alignment
Control
Coverage
CC6.1 (Logical Access)
Every credential issuance and permission grant logged with agent, permissions, policy
CC6.2 (Access Removal)
Session completion and credential revocation logged with timestamps
CC6.3 (Role-Based Access)
Policy evaluations and outcomes logged, showing which policy decided
CC7.2 (Monitoring)
Over-privilege detection flags, critical severity events
CC7.3 (Change Management)
Policy creation/updates versioned and logged
Implementation Phases & Dependencies
Phase 1: Foundation (Week 1)
• Init Next.js 14 + TypeScript + Tailwind + ESLint
• MongoDB connection singleton (lib/db/connection.ts)
• All 5 Mongoose models with indexes and immutability hooks
• API key generation and bcrypt hashing (lib/crypto/api-key-generator.ts)
• Agent auth middleware (lib/auth/api-key-auth.ts)
• Zod validation schemas (lib/validation/schemas.ts)
• Standardized error classes and response helpers
• POST/GET /api/v1/agents and GET /api/v1/health
Deliverable: Agent registration works, API key issued, health endpoint live.
Phase 2: Policy Engine (Week 2)
• Policy CRUD endpoints (POST/GET/PUT /api/v1/policies)
• Permission validator (lib/validation/permission-validator.ts): load policies, deny-first evaluation, ARN pattern matching
• Over-privilege detector (lib/validation/over-privilege-detector.ts): flag wildcards, admin actions, broad resources; compute 0–1 score
• ARN validator (lib/aws/arn-validator.ts)
• Seed script for default policies
Deliverable: Policies evaluatable. Permission requests validated with deny/allow decisions.
Phase 3: STS + Session Lifecycle (Week 3)
• STS client singleton (lib/aws/sts-client.ts)
• IAM policy document builder (lib/aws/policy-document-builder.ts)
• Credential broker (lib/aws/credential-broker.ts): AssumeRole with inline policy
• Credential encryption at rest (lib/crypto/encryption.ts): AES-256-GCM
• POST /api/v1/sessions — full flow end-to-end
• POST /sessions/:id/escalate and POST /sessions/:id/complete
• GET /sessions and GET /sessions/:id
• Rate limiting per agent (lib/rate-limit/limiter.ts)
• Background expiration checker for TTL-expired sessions
Deliverable: Full session lifecycle. Agents create sessions, receive AWS creds, escalate, complete.
Phase 4: Audit System (Week 4)
• Hash chain computation (lib/audit/hash-chain.ts)
• Atomic audit logger (lib/audit/logger.ts): sequence assignment, chaining, insert
• Integrate audit logging into all existing API handlers
• GET /api/v1/audit-logs with filtering and pagination
• GET /api/v1/audit-logs/export with streaming JSON/CSV
• Integrity checker (lib/audit/integrity-checker.ts)
• CLI verification script (scripts/verify-audit-chain.ts)
Deliverable: Every action produces hash-chained audit entry. Logs queryable, exportable, verifiable.
Phase 5: Dashboard (Weeks 5–6)
• NextAuth.js setup with credentials provider
• Dashboard layout: sidebar, topbar, nav links
• UI primitives (shadcn/ui based): button, badge, card, dialog, data-table, tabs, pagination, skeleton, toast
• Overview page with stat cards and recent sessions
• Sessions list + detail page (4 tabs: Overview, Permissions, Escalations, Audit Trail)
• Audit log page with chain integrity banner and export
• Policies page with table and rule builder slide-over
• Agents page with registration dialog and API key reveal
• usePolling hook for live updates on active sessions
• Middleware for dashboard route protection
Deliverable: Fully functional dashboard for session monitoring, audit viewing, policy/agent management.
Phase 6: Hardening (Week 7)
• CORS configuration, payload size limits, content-type validation
• Input sanitization (prevent NoSQL injection)
• Request ID tracking (UUID per request, in responses + audit logs)
• Session tag-based STS revocation for admin-triggered revoke
• Comprehensive error handling across all routes
• Health check with MongoDB + AWS connectivity verification
• Deployment documentation (Docker, IAM setup, env vars)
• End-to-end testing: full agent lifecycle
Deliverable: Production-ready with security measures, error handling, deployment docs.
Phase 7: Polish (Week 8, optional)
• SSE endpoint for live session status (replace polling)
• Dashboard dark mode
• Webhook notifications for session events
• Multi-region AWS support (multiple target roles)
• Agent SDK / TypeScript client library
• Credential auto-rotation before expiry
Key Dependencies
Package
Purpose
next ^14.2
Framework (App Router)
mongoose ^8.5
MongoDB ODM
@aws-sdk/client-sts ^3.600
STS AssumeRole
next-auth ^4.24
Dashboard authentication
bcryptjs ^2.4
API key + password hashing
zod ^3.23
Schema validation
tailwindcss ^3.4
Utility-first CSS
@radix-ui/react-*
Accessible UI primitives
nanoid ^5.0
Entity ID generation
date-fns ^3.6
Date formatting
swr ^2.2
Data fetching + polling
lucide-react
Icons
class-variance-authority ^0.7
Component variants
clsx + tailwind-merge
Conditional class names
vitest ^1.6
Testing
mongodb-memory-server ^9.4
In-memory MongoDB for tests
Verification Plan
1. Unit tests: Models, permission validator, hash chain, ARN validator, policy document builder
2. Integration tests: Full session lifecycle (create → escalate → complete) with mocked STS
3. API tests: All endpoints — happy path + error cases + auth failures + rate limiting
4. Dashboard: Manual test — register agent, create session, view detail page, check audit trail, export
5. Audit integrity: Run scripts/verify-audit-chain.ts after test suite — chain intact
6. Security: No secrets in API responses (except creds endpoint), immutable logs, bcrypt timing