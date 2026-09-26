import type { Agent, PermissionEntry, Policy } from "@/types/dashboard";

/**
 * Usage snippets and a CLAUDE.md for one agent.
 *
 * Flow: the agent only ever holds its AgentVault key. It opens a session, then asks
 * AgentVault to make each AWS call; AWS credentials never leave the server.
 * (Server-side calls: docs/SERVER_SIDE_AWS.md.)
 */

const FALLBACK: PermissionEntry = { service: "s3", action: "GetObject", resource: "arn:aws:s3:::example-bucket/*", effect: "Allow" };

/** A permission this agent is likely to be granted: the first concrete allow rule in an active policy. */
export function samplePermission(policies: Policy[] | undefined): PermissionEntry {
  for (const p of policies ?? []) {
    if (p.status !== "active") continue;
    for (const r of p.rules) {
      if (r.effect !== "allow") continue;
      const service = r.services.find((s) => s !== "*");
      const action = r.actions.find((a) => !a.includes("*"));
      const resource = r.resources.find((x) => x.startsWith("arn:"));
      if (service && action && resource) return { service, action, resource, effect: "Allow" };
    }
  }
  return FALLBACK;
}

/** Example AWS call parameters for the sample permission (S3 gets a real bucket/key; others stay empty). */
function sampleParams(p: PermissionEntry): Record<string, string> {
  if (p.service !== "s3") return {};
  const [bucket, ...rest] = p.resource.replace(/^arn:aws[a-z-]*:s3:::/, "").split("/");
  const key = rest.join("/").replace(/\*/g, "") || "";
  return p.action === "ListBucket" ? { Bucket: bucket } : { Bucket: bucket, Key: `${key}example.txt`.replace(/^\//, "") };
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

// Snippet JSON goes inside single quotes in the shell, so it must not contain one.
const shellSafe = (s: string) => s.replace(/'/g, "");

/** Free text (agent names) on one line, so it can't break out of a shell comment or a markdown line. */
const oneLine = (s: string) => s.replace(/[`\r\n]+/g, " ").trim();

/** Keys are base62 with an avk_ prefix; anything else is treated as not provided. */
const isKey = (k: string | undefined): k is string => !!k && /^avk_(live|test)_[A-Za-z0-9]{8,}$/.test(k);

/**
 * How the key appears in the X-API-Key header:
 *  - a real key (pasted by the user, kept in memory only) → used as-is
 *  - "env" → $AGENTVAULT_API_KEY (for CLAUDE.md, which lives in a repo)
 *  - nothing → a visible placeholder showing the key's prefix
 */
export type KeySource = { apiKey?: string; env?: boolean };

function keyRef(agent: Pick<Agent, "apiKeyPrefix">, src: KeySource) {
  if (src.env) return "$AGENTVAULT_API_KEY";
  if (isKey(src.apiKey)) return src.apiKey;
  return `${oneLine(agent.apiKeyPrefix)}…YOUR_KEY`;
}

export interface CurlSnippets {
  request: string;
  awsCall: string;
  escalate: string;
  complete: string;
}

export function curlSnippets(baseUrl: string, agent: Pick<Agent, "apiKeyPrefix">, sample: PermissionEntry, src: KeySource = {}): CurlSnippets {
  const api = `${baseUrl}/api/v1`;
  const key = keyRef(agent, src);
  const headers = `  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\`;

  const requestBody = shellSafe(
    json({
      gist: "Read one report from S3 and summarize it",
      permissions: [{ service: sample.service, action: sample.action, resource: sample.resource }],
      estimatedDuration: 900,
    }),
  );
  const awsBody = shellSafe(json({ service: sample.service, action: sample.action, params: sampleParams(sample) }));
  const escalateBody = shellSafe(
    json({
      additionalPermissions: [{ service: "s3", action: "PutObject", resource: "arn:aws:s3:::example-bucket/summaries/*" }],
      reason: "Need to write the summary back to the bucket",
    }),
  );

  return {
    request: `SESSION_ID=$(curl -s -X POST "${api}/sessions" \\
${headers}
  -d '${requestBody}' | tee /dev/stderr | jq -r '.data.sessionId')`,
    awsCall: `curl -s -X POST "${api}/sessions/$SESSION_ID/aws" \\
${headers}
  -d '${awsBody}'`,
    escalate: `curl -s -X POST "${api}/sessions/$SESSION_ID/escalate" \\
${headers}
  -d '${escalateBody}'`,
    complete: `curl -s -X POST "${api}/sessions/$SESSION_ID/complete" \\
${headers}
  -d '{"summary": "What was done, or what failed"}'`,
  };
}

const md = oneLine;

export function claudeMd(baseUrl: string, agent: Agent, sample: PermissionEntry, embeddedKey?: string): string {
  const hasKey = !!embeddedKey;
  const c = hasKey
    ? curlSnippets(baseUrl, agent, sample, { apiKey: embeddedKey })
    : curlSnippets(baseUrl, agent, sample, { env: true });

  const keySection = hasKey
    ? `- **Your credential:** the AgentVault API key is embedded in the commands below.
  - The key: \`${embeddedKey}\`
  - Keep this file secure — it contains a live credential.
  - Never print, log, or commit the key to version control separately.`
    : `- **Your only credential:** the AgentVault key in the \`AGENTVAULT_API_KEY\` environment variable
  (it starts with \`${agent.apiKeyPrefix}\`).
  - Never print the key, commit it, or write it to a file.
  - If it isn't set, stop and ask the user to set it. Don't search for it elsewhere.`;

  return `# AgentVault: cloud access for this repo

The AI agent working in this repo is registered in AgentVault as **${md(agent.name)}** (\`${agent.agentId}\`)${
    agent.description ? ` — ${md(agent.description)}` : ""
  }.

You never get AWS keys directly. You open a session with AgentVault, declare what you need to do, and
AgentVault issues scoped, time-bound credentials — only for the permissions the session allows.
Close the session when you're done.

## Setup

- **Base URL:** ${baseUrl}
${keySection}
- **Tools:** \`curl\` and \`jq\`.

## Rules

1. **All AWS access goes through AgentVault.** Don't use the AWS CLI, SDKs, or any AWS keys you find.
2. **Ask only for what the task needs.** Use specific actions (\`GetObject\`, not \`*\`) and specific resource ARNs.
3. **Describe the task honestly** in \`gist\`. It is reviewed (including by Claude) and written to the audit log.
4. **A denial is final.** Don't retry the same request or find a workaround. Tell the user what was denied and why.
5. **Need more access mid-task?** Use escalate with a clear reason. At most 3 escalations per session.
6. **Always complete the session** when you finish, even if the task failed, with a one-line summary.
7. **Everything is logged.** Every request, AWS call, denial and completion is recorded in a tamper-evident log.

## 1. Open a session for the task

\`\`\`bash
${c.request}
\`\`\`

The full response is printed to stderr. \`SESSION_ID\` is captured automatically.

**Check the response before proceeding:**
- \`grantedPermissions\` — what you can do
- \`deniedPermissions\` — if something you need was denied, **stop and tell the user**
- \`overPrivilegeFlags\` — AgentVault flagged you asked for more than needed. Narrow your request next time.
- \`credentials\` — scoped AWS credentials (if using direct AWS access mode)
- \`ttl.expiresAt\` — when credentials expire. Plan your work to finish before this.

## 2. Make AWS calls through AgentVault

\`\`\`bash
${c.awsCall}
\`\`\`

\`service\` and \`action\` use AWS names; \`params\` are the normal AWS API parameters for that action.
Calls outside the session's granted permissions are rejected with 403.

## 3. Ask for more access (only if needed)

\`\`\`bash
${c.escalate}
\`\`\`

Old credentials are revoked, new ones issued with combined permissions.

## 4. Finish — always

\`\`\`bash
${c.complete}
\`\`\`

## Tips for requesting credentials

### Be specific with permissions
Bad: \`{ "service": "s3", "action": "*", "resource": "*" }\`
Good: \`{ "service": "s3", "action": "GetObject", "resource": "arn:aws:s3:::my-bucket/reports/*" }\`

### Common permission patterns

| Task | Service | Action | Resource pattern |
|---|---|---|---|
| Read from S3 | s3 | GetObject | \`arn:aws:s3:::bucket-name/path/*\` |
| Write to S3 | s3 | PutObject | \`arn:aws:s3:::bucket-name/path/*\` |
| Read DynamoDB | dynamodb | GetItem, Query | \`arn:aws:dynamodb:*:*:table/table-name\` |
| Write DynamoDB | dynamodb | PutItem | \`arn:aws:dynamodb:*:*:table/table-name\` |
| Deploy Lambda | lambda | CreateFunction, UpdateFunctionCode | \`arn:aws:lambda:*:*:function:func-name\` |
| Read logs | logs | FilterLogEvents, GetLogEvents | \`arn:aws:logs:*:*:log-group:*\` |

### Handling credential expiry
- Sessions have a TTL (default 1 hour, max 12 hours). Check \`ttl.expiresAt\` in the session response.
- If your task takes longer, set \`estimatedDuration\` appropriately when opening the session.
- If credentials expire mid-task, open a new session with the remaining work described in \`gist\`.

### When permissions are denied
1. Check the \`deniedPermissions\` array — it tells you exactly what was blocked and why.
2. If it's a policy denial, the admin needs to update policies. Tell the user.
3. If it's an over-privilege flag, narrow your request to only what's needed.
4. Never try to work around denials — they exist for security.

### Multiple operations in one session
- Open **one session** for a logical task, not one per AWS call.
- Request all permissions you'll need upfront.
- If you discover you need more mid-task, use escalate (max 3 times per session).

## Permission format

\`\`\`json
{ "service": "s3", "action": "GetObject", "resource": "arn:aws:s3:::bucket-name/path/*" }
\`\`\`

- \`resource\` must be a full ARN. A bare \`*\` is rejected.
- \`estimatedDuration\` is in seconds (60 to 43200). A session lasts at most 1 hour.

## Errors

| Status | Meaning | What to do |
|---|---|---|
| 400 | Invalid request (bad ARN or params) | Fix the request and retry |
| 401 | Missing or wrong AgentVault key | ${hasKey ? "Check the key in this file is still valid" : "Ask the user to check \\`AGENTVAULT_API_KEY\\`"} |
| 403 | Not allowed: outside session scope, agent suspended, or policy denial | Escalate with a reason, or stop and tell the user |
| 409 | Session no longer active (completed, expired or revoked) | Open a new session |
| 429 | Rate limit: too many requests or active sessions | Complete open sessions, then retry |

## Troubleshooting

- **"No active session"** — You tried to call AWS without opening a session first. Run step 1.
- **"Session expired"** — TTL exceeded. Open a new session for remaining work.
- **"All permissions denied"** — No matching allow policy. Ask the user/admin to create one.
- **"Agent suspended"** — This agent has been disabled. Ask the user to check the AgentVault dashboard.
`;
}
