# AgentVault — Demo Flow

## How It Works

```
Developer writes task spec (MD file)
        │
        ▼
AI Agent (Claude Code CLI) reads spec
        │
        ▼
Agent calls AgentVault API → declares intent + permissions needed
        │
        ▼
AgentVault validates permissions (policy engine + optional AI review)
        │
        ▼
AgentVault issues scoped, time-bound AWS credentials
        │
        ▼
Agent executes task using those credentials
        │
        ▼
Agent calls AgentVault to complete session → credentials revoked
        │
        ▼
Everything logged immutably with hash-chained audit trail
```

---

## Step-by-Step Demo

### 1. Register an Agent

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "claude-code-deployer",
    "description": "Claude Code CLI agent for infrastructure deployment",
    "metadata": {
      "team": "platform",
      "environment": "staging"
    }
  }'
```

**Response** — save the `apiKey`, it's shown only once:
```json
{
  "data": {
    "agentId": "agt_abc123...",
    "name": "claude-code-deployer",
    "apiKey": "avk_live_xK9m2pQ7..."
  }
}
```

### 2. Create a Policy (what the agent is allowed to do)

```bash
curl -X POST http://localhost:3000/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "staging-lambda-deploy",
    "rules": [
      {
        "effect": "allow",
        "services": ["lambda", "s3", "dynamodb", "logs"],
        "actions": ["*"],
        "resources": ["arn:aws:*:us-east-1:123456789012:*"]
      },
      {
        "effect": "deny",
        "services": ["iam", "organizations", "sts"],
        "actions": ["*"],
        "resources": ["*"]
      }
    ],
    "scope": {
      "agentIds": [],
      "agentMetadata": { "environment": "staging" }
    },
    "constraints": {
      "maxSessionDuration": 3600,
      "maxEscalationsPerSession": 2
    },
    "priority": 10
  }'
```

### 3. Agent Requests a Credential Session

This is the core flow. The AI agent declares **what it's doing** (gist) and **what AWS permissions it needs**:

```bash
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: avk_live_xK9m2pQ7..." \
  -d '{
    "gist": "Deploy user-service Lambda function with DynamoDB table for user profiles",
    "permissions": [
      {
        "service": "lambda",
        "action": "CreateFunction",
        "resource": "arn:aws:lambda:us-east-1:123456789012:function:user-service-*"
      },
      {
        "service": "lambda",
        "action": "UpdateFunctionCode",
        "resource": "arn:aws:lambda:us-east-1:123456789012:function:user-service-*"
      },
      {
        "service": "dynamodb",
        "action": "CreateTable",
        "resource": "arn:aws:dynamodb:us-east-1:123456789012:table/user-profiles"
      },
      {
        "service": "s3",
        "action": "PutObject",
        "resource": "arn:aws:s3:::deploy-artifacts/user-service/*"
      }
    ],
    "estimatedDuration": 1800
  }'
```

**Response** — scoped credentials + validation results:
```json
{
  "data": {
    "sessionId": "sess_m3Kx9pQvR7tW2jN5bL8y",
    "status": "active",
    "credentials": {
      "accessKeyId": "ASIAMOCK...",
      "secretAccessKey": "mock-secret-...",
      "sessionToken": "mock-session-token-...",
      "expiration": "2026-09-26T11:30:00.000Z",
      "region": "us-east-1"
    },
    "grantedPermissions": [...],
    "deniedPermissions": [],
    "overPrivilegeFlags": [],
    "aiValidation": {
      "approved": true,
      "reasoning": "Permissions align with stated intent of deploying a Lambda function with DynamoDB.",
      "flaggedPermissions": [],
      "confidenceScore": 0.95
    },
    "_mock": true,
    "ttl": {
      "issuedAt": "2026-09-26T11:00:00.000Z",
      "expiresAt": "2026-09-26T11:30:00.000Z",
      "durationSeconds": 1800
    }
  }
}
```

### 4. Mid-Task Escalation (if agent needs more permissions)

```bash
curl -X POST http://localhost:3000/api/v1/sessions/sess_m3Kx9pQvR7tW2jN5bL8y/escalate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: avk_live_xK9m2pQ7..." \
  -d '{
    "additionalPermissions": [
      {
        "service": "cloudwatch",
        "action": "PutMetricAlarm",
        "resource": "arn:aws:cloudwatch:us-east-1:123456789012:alarm:user-service-*"
      }
    ],
    "reason": "Need CloudWatch alarm for Lambda error rate monitoring"
  }'
```

Old credentials revoked, new credentials issued with combined permissions.

### 5. Complete Session

```bash
curl -X POST http://localhost:3000/api/v1/sessions/sess_m3Kx9pQvR7tW2jN5bL8y/complete \
  -H "Content-Type: application/json" \
  -H "X-API-Key: avk_live_xK9m2pQ7..." \
  -d '{
    "summary": "Deployed user-service Lambda + DynamoDB table + CloudWatch alarms"
  }'
```

All credentials revoked. Session closed. Full audit trail recorded.

### 6. View Audit Trail

```bash
curl "http://localhost:3000/api/v1/audit-logs?sessionId=sess_m3Kx9pQvR7tW2jN5bL8y"
```

Returns hash-chained, immutable audit entries — every permission request, grant, denial, escalation, credential issuance, and revocation.

---

## The AI Agent Workflow

This is how AgentVault fits into real AI agent development:

### Step 1: Write a Task Spec

Create a file like `tasks/deploy-user-service.md`:

```markdown
# Task: Deploy User Service

## What to do
Deploy the user-service Lambda function with a DynamoDB table for user profiles.

## AgentVault Session
- **Endpoint**: POST https://your-agentvault.vercel.app/api/v1/sessions
- **API Key**: Use environment variable AGENTVAULT_API_KEY
- **Payload**:
  ```json
  {
    "gist": "Deploy user-service Lambda function with DynamoDB table",
    "permissions": [
      { "service": "lambda", "action": "CreateFunction", "resource": "arn:aws:lambda:us-east-1:123456789012:function:user-service-*" },
      { "service": "lambda", "action": "UpdateFunctionCode", "resource": "arn:aws:lambda:us-east-1:123456789012:function:user-service-*" },
      { "service": "dynamodb", "action": "CreateTable", "resource": "arn:aws:dynamodb:us-east-1:123456789012:table/user-profiles" },
      { "service": "s3", "action": "PutObject", "resource": "arn:aws:s3:::deploy-artifacts/user-service/*" }
    ],
    "estimatedDuration": 1800
  }
  ```

## Steps
1. Request credentials from AgentVault using the payload above
2. Use the returned AWS credentials to:
   - Package the Lambda function code
   - Upload to S3
   - Create/update the Lambda function
   - Create the DynamoDB table
3. Complete the AgentVault session with a summary

## On Failure
- Complete the session even on failure (credentials get revoked)
- Include error details in the summary
```

### Step 2: Point Claude Code at It

```bash
claude "Read tasks/deploy-user-service.md and execute the deployment"
```

Claude Code reads the spec, calls AgentVault, gets scoped creds, does the work, completes the session.

---

## Switching from Mock to Real AWS

1. Set up AWS IAM (see `AWS_SETUP.md`)
2. In `.env`:
   ```
   USE_MOCK_STS=false
   AWS_TARGET_ROLE_ARN=arn:aws:iam::123456789012:role/AgentWorkload-Staging
   AWS_ACCESS_KEY_ID=your-broker-access-key
   AWS_SECRET_ACCESS_KEY=your-broker-secret-key
   ```
3. Deploy. Everything else stays the same — same API, same flow, real credentials now.

---

## Quick Start (MVP / Demo)

```bash
# 1. Clone and install
cd agent-vault && npm install

# 2. Set up .env (MongoDB Atlas + mock STS)
cp .env.example .env
# Edit: set MONGODB_URI to your Atlas cluster
# Keep USE_MOCK_STS=true

# 3. Run
npm run dev

# 4. Register an agent
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "test-agent", "description": "Demo agent"}'

# 5. Create a session (uses mock credentials)
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <key-from-step-4>" \
  -d '{
    "gist": "Test deployment",
    "permissions": [
      {"service": "s3", "action": "PutObject", "resource": "arn:aws:s3:::my-bucket/*"}
    ],
    "estimatedDuration": 600
  }'

# 6. Check health
curl http://localhost:3000/api/v1/health
```
