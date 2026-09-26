# Agent Task: Deploy User Service

> This file is a task specification for an AI agent (e.g., Claude Code CLI).
> The agent reads this file, requests scoped AWS credentials from AgentVault,
> executes the task, then completes the session.

## Context
We're deploying a new user-service microservice. It needs a Lambda function
and a DynamoDB table. The deployment artifacts go to S3.

## AgentVault Configuration

**Base URL**: `https://your-agentvault.vercel.app` (or `http://localhost:3000` for local)

### Request Credentials
```
POST /api/v1/sessions
Header: X-API-Key: $AGENTVAULT_API_KEY
Content-Type: application/json
```

```json
{
  "gist": "Deploy user-service Lambda function with DynamoDB table for user profiles in staging",
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
      "service": "lambda",
      "action": "GetFunction",
      "resource": "arn:aws:lambda:us-east-1:123456789012:function:user-service-*"
    },
    {
      "service": "dynamodb",
      "action": "CreateTable",
      "resource": "arn:aws:dynamodb:us-east-1:123456789012:table/user-profiles"
    },
    {
      "service": "dynamodb",
      "action": "DescribeTable",
      "resource": "arn:aws:dynamodb:us-east-1:123456789012:table/user-profiles"
    },
    {
      "service": "s3",
      "action": "PutObject",
      "resource": "arn:aws:s3:::staging-deploy-artifacts/user-service/*"
    }
  ],
  "estimatedDuration": 1800
}
```

### If You Need More Permissions Mid-Task
```
POST /api/v1/sessions/{sessionId}/escalate
Header: X-API-Key: $AGENTVAULT_API_KEY
```

### When Done
```
POST /api/v1/sessions/{sessionId}/complete
Header: X-API-Key: $AGENTVAULT_API_KEY
Body: { "summary": "What you accomplished" }
```

## Steps

1. Call AgentVault to get AWS credentials (use the payload above)
2. Save the returned `sessionId` — you'll need it for escalation or completion
3. Export the returned credentials as environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=<from response>
   export AWS_SECRET_ACCESS_KEY=<from response>
   export AWS_SESSION_TOKEN=<from response>
   export AWS_REGION=us-east-1
   ```
4. Package the Lambda function code into a zip
5. Upload the zip to S3: `s3://staging-deploy-artifacts/user-service/`
6. Create or update the Lambda function using the S3 artifact
7. Create the DynamoDB table `user-profiles` with:
   - Partition key: `userId` (String)
   - Sort key: `createdAt` (Number)
   - On-demand billing
8. Verify both resources are active
9. Complete the AgentVault session with a summary

## On Failure
- Always complete the AgentVault session, even on failure
- Include error details in the completion summary
- Credentials will be revoked on completion

## Constraints
- Credentials expire in 30 minutes — work within that window
- Do NOT request permissions beyond what's listed above
- If you need additional permissions, use the escalation endpoint with a reason
