# User-level access: sign in from the CLI, act on behalf of a person

**Status:** frontend ready, backend not started. This doc is the spec for the backend work.

## Why

Today an agent is identified only by its API key. If the key leaks, anyone can use it, and the audit log says
"s3-reader-agent did X" without saying *who* ran it.

With user-level access:

1. **A person must sign in from the terminal first.** No sign-in, no credentials.
2. **Every person has a limit** set by an admin, like "Arun: S3 read/write in staging, nothing in production".
3. **An agent can never get more than the person running it.** It also can't exceed its own limit.
4. **Every action traces back to that person** in the audit log and on the dashboard.

## The flow in plain words

```
$ agentvault login
  Open https://agentvault.example.com/dashboard/cli/authorize?code=WDJB-MJHT
  Code: WDJB-MJHT      (waiting for approval…)

  → browser: user is signed in to the dashboard, checks the code matches, clicks Allow
  ✓ Logged in as arun@acme.dev (expires in 12h)

$ claude "Read sample-agent-task.md and execute it"
  → the agent requests credentials with the user's CLI token and the agent's key
  → AgentVault checks: request ∩ user's limit ∩ agent's limit ∩ baseline, then Claude reviews
  → a 15-minute token is issued; the audit log records "arun via s3-reader-agent"
```

This is the OAuth 2.0 device authorization flow (RFC 8628), the same pattern as `gh auth login`.

## How a request is decided

```
what the agent asks for
   ∩ the user's limit          (policies attached to the person)
   ∩ the agent's limit         (policies attached to the agent)
   ∩ global baseline           (e.g. security-baseline: never iam:* / sts:*)
   = what is granted
```

Then Claude reviews what's left against the stated task:

| Claude's finding | Decision |
|---|---|
| high severity ("not needed, risky") | deny that permission, with Claude's reason |
| medium | grant, with a shorter TTL and a warning in the audit log |
| none | grant |
| Claude unavailable | fall back to the rule-based detector; deny anything critical |

Optional step-up: for sensitive actions (delete, production), the CLI asks the person to confirm before issuing.

## What the frontend already does

| Piece | Where | Behaviour until the backend ships |
|---|---|---|
| Terminal approval page | `app/dashboard/cli/authorize/page.tsx` | Login required (dashboard middleware). Calling the endpoints returns 404, so the page says "CLI sign-in isn't enabled on this server yet." |
| API client calls | `lib/api/client.ts` → `api.cli.*` | `lookupDevice`, `approveDevice`, `denyDevice` |
| Types | `types/dashboard.ts` | `RequestedBy`, `Session.requestedBy?`, `CliDeviceRequest` |
| "On behalf of" display | sessions table, session detail header | Hidden while `requestedBy` is absent |
| Landing page | `app/page.tsx` | Describes this flow (sign in → declare → check → issue → expire) |

## Backend work required

### Data

- **`users.policyIds: string[]`** — the person's limit. Admin-editable.
- **`agents.assignedPolicies`** — actually save the policies chosen at registration. Today `POST /api/v1/agents` ignores
  `policyIds` and the validator never reads this field. Store policy IDs (strings), not ObjectIds.
- **`cli_device_requests`** — `{ deviceCodeHash, userCode, clientName, status: pending|approved|denied|expired,
  userId?, requestedAt, expiresAt }`. TTL index on `expiresAt` (10 minutes).
- **`cli_tokens`** — `{ tokenHash, userId, clientName, createdAt, expiresAt, revokedAt?, lastUsedAt }`. Store a hash,
  never the raw token. Expire after 12 hours.
- **`sessions.requestedBy`** — `{ userId, email, name, via: "cli" | "dashboard" }` (shape in `types/dashboard.ts`).
- **Audit entries** — add `onBehalfOf: userId` to `details` for session, escalation and completion events.

### Endpoints

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/v1/cli/device/code` | none (rate-limited) | CLI starts login → `{ deviceCode, userCode, verificationUri, expiresIn, interval }` |
| `POST /api/v1/cli/device/token` | device code | CLI polls → `authorization_pending` / `slow_down` / `access_denied` / `expired_token` / `{ accessToken, expiresAt, user }` |
| `GET /api/v1/cli/device/:userCode` | dashboard session | Approval page shows the pending request (`CliDeviceRequest`) |
| `POST /api/v1/cli/device/:userCode/approve` | dashboard session | Bind the request to the signed-in user |
| `POST /api/v1/cli/device/:userCode/deny` | dashboard session | Reject it |
| `GET /api/v1/cli/whoami` | CLI token | Who am I, when does my login expire |
| `POST /api/v1/cli/logout` | CLI token | Revoke the CLI token |

### Session creation changes (`POST /api/v1/sessions`, escalate, complete)

1. Require **both** `X-API-Key` (the agent) and `Authorization: Bearer <cli token>` (the person). Missing or expired
   CLI token → `401 { code: "LOGIN_REQUIRED", message: "Run agentvault login" }`.
2. Reject if the user is disabled, or the CLI token is revoked or expired.
3. Evaluate `request ∩ user policies ∩ agent policies ∩ baseline` (change `validatePermissions`).
4. Enforce the policy constraints that are stored today but unused: `maxSessionDuration`, `maxEscalationsPerSession`,
   `maxConcurrentSessions`, `allowedRegions`.
5. Apply Claude's decision table above, and run Claude on escalations too.
6. Save `requestedBy` on the session and `onBehalfOf` in every audit entry.
7. When a user is disabled or logs out: revoke their CLI tokens and all their active sessions.

### CLI

A small `agentvault` binary (or a Claude Code MCP server) with `login`, `logout`, `whoami`, and `request`. It stores the
token in the OS keychain (not a plain file) and sends it with each request. Claude Code never sees the raw token.

## Security rules

- User codes: 8 characters from an unambiguous alphabet (no 0/O, 1/I), single use, expire in 10 minutes.
- Poll at most every `interval` seconds (default 5); return `slow_down` if faster. Rate-limit code creation per IP.
- The approval page always shows the code and the client name, and warns: only approve a code you started yourself.
  (This defends against someone sending you their code.)
- Hash device codes and CLI tokens at rest (SHA-256). Compare in constant time.
- CLI tokens are scoped to requesting credentials only. They can't be used for dashboard or admin routes.
- Log `cli.login.approved`, `cli.login.denied` and `cli.logout` in the audit chain.

## Other backend issues found during the frontend audit (not fixed; frontend-only change)

1. **`POST /api/v1/agents` has no authentication.** Anyone can register an agent and get a working API key. It needs
   `requireDashboardAuth('agents:create')`.
2. **Read endpoints are public.** `GET /api/v1/sessions`, `/sessions/:id`, `/audit-logs`, `/audit-logs/export`,
   `/analytics`, `/agents`, `/policies` return data without a dashboard session. Only the dashboard pages are protected.
3. **Default admin password.** `scripts/seed-admin.ts` defaults to `admin123`. Require `ADMIN_PASSWORD` to be set, or
   force a change on first login. An admin with the default password currently exists in the shared database.
4. **`npm run seed:admin` loads `.env`**, but the project uses `.env.local`, so it silently seeds a local MongoDB instead.
5. **Claude's flags don't block anything yet.** See the decision table above.
