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

  return `# AgentVault: AWS credentials for AI agents

This file contains everything you need to get **temporary, scoped AWS credentials** (access key, secret key, session token) for implementing any AWS flow. You request credentials from AgentVault by describing your task and the permissions you need. AgentVault validates, issues time-bound credentials, and logs everything.

**Agent:** ${md(agent.name)} (\`${agent.agentId}\`)${agent.description ? ` — ${md(agent.description)}` : ""}

## Setup

- **Base URL:** ${baseUrl}
${keySection}
- **Tools:** \`curl\` and \`jq\`.

## How it works

1. You call AgentVault's session API with your task description and needed permissions
2. AgentVault checks policies, validates intent, and issues scoped AWS credentials
3. You export the credentials as environment variables (\`AWS_ACCESS_KEY_ID\`, \`AWS_SECRET_ACCESS_KEY\`, \`AWS_SESSION_TOKEN\`)
4. You use the AWS CLI or SDK with those credentials to perform your task
5. When done, you complete the session — credentials are revoked

## Step 1: Request AWS credentials

\`\`\`bash
${c.request}
\`\`\`

### Extract and export the AWS credentials

After the session is created, extract the credentials from the response and export them:

\`\`\`bash
export AWS_ACCESS_KEY_ID=$(echo "$RESPONSE" | jq -r '.data.credentials.accessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$RESPONSE" | jq -r '.data.credentials.secretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$RESPONSE" | jq -r '.data.credentials.sessionToken')
export AWS_DEFAULT_REGION=$(echo "$RESPONSE" | jq -r '.data.credentials.region')
\`\`\`

Or in a single call that captures and exports:

\`\`\`bash
RESPONSE=$(curl -s -X POST "${baseUrl}/api/v1/sessions" \\
${hasKey ? `  -H "X-API-Key: ${embeddedKey}" \\` : '  -H "X-API-Key: $AGENTVAULT_API_KEY" \\'}
  -H "Content-Type: application/json" \\
  -d '{ "gist": "YOUR TASK DESCRIPTION", "permissions": [YOUR_PERMISSIONS], "estimatedDuration": 900 }')

SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.sessionId')
export AWS_ACCESS_KEY_ID=$(echo "$RESPONSE" | jq -r '.data.credentials.accessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$RESPONSE" | jq -r '.data.credentials.secretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$RESPONSE" | jq -r '.data.credentials.sessionToken')
export AWS_DEFAULT_REGION=$(echo "$RESPONSE" | jq -r '.data.credentials.region')
\`\`\`

Now you can use \`aws s3\`, \`aws dynamodb\`, \`aws lambda\`, etc. with these credentials.

## Step 2: Use the credentials

Once exported, use standard AWS CLI or SDK calls:

\`\`\`bash
# S3 example
aws s3 cp s3://my-bucket/file.txt ./file.txt

# DynamoDB example
aws dynamodb get-item --table-name my-table --key '{"id": {"S": "123"}}'

# Lambda example
aws lambda invoke --function-name my-function output.json
\`\`\`

## Step 3: Escalate if needed

\`\`\`bash
${c.escalate}
\`\`\`

Old credentials are revoked, new ones issued with combined permissions. Re-export the new credentials.

## Step 4: Complete the session (always)

\`\`\`bash
${c.complete}
\`\`\`

**Always complete the session** when done — even if the task failed. Include a summary of what happened.

## How to request permissions

### Permission format

\`\`\`json
{ "service": "s3", "action": "GetObject", "resource": "arn:aws:s3:::bucket-name/path/*" }
\`\`\`

**Important rules for permissions:**
- \`resource\` must be a **specific ARN** — bare wildcards (\`*\`) are rejected
- Use specific actions (\`GetObject\`, \`PutItem\`) not wildcards (\`*\`)
- \`estimatedDuration\` is in seconds (60 to 43200)

### Common permission patterns

| Task | Service | Action | Resource |
|---|---|---|---|
| Download from S3 | s3 | GetObject | \`arn:aws:s3:::bucket-name/path/*\` |
| List S3 bucket | s3 | ListBucket | \`arn:aws:s3:::bucket-name\` |
| Upload to S3 | s3 | PutObject | \`arn:aws:s3:::bucket-name/path/*\` |
| Read DynamoDB | dynamodb | GetItem | \`arn:aws:dynamodb:us-east-1:*:table/table-name\` |
| Query DynamoDB | dynamodb | Query | \`arn:aws:dynamodb:us-east-1:*:table/table-name\` |
| Write DynamoDB | dynamodb | PutItem | \`arn:aws:dynamodb:us-east-1:*:table/table-name\` |
| Deploy Lambda | lambda | UpdateFunctionCode | \`arn:aws:lambda:us-east-1:*:function:func-name\` |
| Invoke Lambda | lambda | InvokeFunction | \`arn:aws:lambda:us-east-1:*:function:func-name\` |
| Read CloudWatch Logs | logs | GetLogEvents | \`arn:aws:logs:us-east-1:*:log-group:group-name\` |

### Example: Download files from S3

\`\`\`bash
RESPONSE=$(curl -s -X POST "${baseUrl}/api/v1/sessions" \\
${hasKey ? `  -H "X-API-Key: ${embeddedKey}" \\` : '  -H "X-API-Key: $AGENTVAULT_API_KEY" \\'}
  -H "Content-Type: application/json" \\
  -d '{
    "gist": "Download report files from S3 bucket",
    "permissions": [
      { "service": "s3", "action": "GetObject", "resource": "arn:aws:s3:::demo-bucket/*" },
      { "service": "s3", "action": "ListBucket", "resource": "arn:aws:s3:::demo-bucket" }
    ],
    "estimatedDuration": 900
  }')

SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.sessionId')
export AWS_ACCESS_KEY_ID=$(echo "$RESPONSE" | jq -r '.data.credentials.accessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$RESPONSE" | jq -r '.data.credentials.secretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$RESPONSE" | jq -r '.data.credentials.sessionToken')
export AWS_DEFAULT_REGION=$(echo "$RESPONSE" | jq -r '.data.credentials.region')

# Now use AWS CLI
aws s3 ls s3://demo-bucket/
aws s3 cp s3://demo-bucket/report.csv ./report.csv

# Complete session when done
curl -s -X POST "${baseUrl}/api/v1/sessions/$SESSION_ID/complete" \\
${hasKey ? `  -H "X-API-Key: ${embeddedKey}" \\` : '  -H "X-API-Key: $AGENTVAULT_API_KEY" \\'}
  -H "Content-Type: application/json" \\
  -d '{"summary": "Downloaded report.csv from S3"}'
\`\`\`

## Handling denials — auto-retry

If your request is denied, the API response includes a \`suggestions\` field that tells you exactly how to fix it.

**When you get a 403 error with denied permissions:**
1. Read \`details.suggestions\` in the error response
2. Each suggestion has a \`retryWith\` field containing a corrected permission object
3. **Retry the same API call** with the corrected permissions from the suggestions
4. If the suggestion says a service is explicitly blocked (e.g., IAM), do not retry — tell the user

Example denied response:
\`\`\`json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "All requested permissions were denied",
    "details": {
      "suggestions": [
        {
          "denied": "s3:GetObject on *",
          "reason": "No matching allow policy found",
          "suggestion": "Resource \\"*\\" is too broad. Use arn:aws:s3:::my-bucket/*",
          "retryWith": { "service": "s3", "action": "GetObject", "resource": "arn:aws:s3:::my-bucket/*" }
        }
      ],
      "hint": "Retry with corrected permissions as shown in each suggestion"
    }
  }
}
\`\`\`

**Auto-retry procedure:**
1. Parse the \`retryWith\` objects from the suggestions
2. Rebuild your permissions array using the suggested corrections
3. Call the session API again with the corrected permissions
4. If denied again with no suggestions, stop and tell the user

## Rules

1. **All AWS access goes through AgentVault.** Get credentials from AgentVault, use them with AWS CLI/SDK.
2. **Use specific actions and ARNs.** Never use wildcard \`*\` for actions or resources.
3. **Describe the task honestly** in \`gist\`. It is logged and reviewed.
4. **Auto-retry on denial.** If denied, check the \`suggestions\` field and retry with corrected permissions.
5. **If explicitly blocked** (e.g., IAM, STS, Organizations), do not retry — tell the user.
6. **Always complete the session** when finished, even on failure.
7. **Everything is logged.** Every request is recorded in a tamper-evident audit trail.

## Errors

| Status | Meaning | What to do |
|---|---|---|
| 400 | Invalid request (bad ARN or params) | Fix the request and retry |
| 401 | Missing or wrong API key | ${hasKey ? "Check the key in this file is still valid" : "Ask the user to check \\`AGENTVAULT_API_KEY\\`"} |
| 403 | Denied — check \`details.suggestions\` for how to fix | Auto-retry with corrected permissions from suggestions |
| 409 | Session no longer active | Open a new session |
| 429 | Rate limit exceeded | Complete open sessions, then retry |
`;
}
