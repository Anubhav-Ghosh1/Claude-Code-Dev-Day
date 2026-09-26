# Server-side AWS calls: agents only hold their AgentVault key

**Status:** frontend (curl guide, CLAUDE.md) uses this flow. Backend endpoint not built yet.

## The idea

Agents never receive AWS credentials. An agent opens a session with its AgentVault key, then asks AgentVault to
make each AWS call. AgentVault checks the call against the session's granted permissions, makes it with its own
short-lived STS credentials, and returns the result.

```
agent ──X-API-Key + {service, action, params}──► AgentVault ──(session's STS creds)──► AWS
agent ◄───────────────────────── result ───────────────────────────────────────────────┘
```

Why: AWS credentials can't leak from the agent, every single AWS call is checked and audit-logged (real
out-of-scope detection), and revoking a session stops access immediately instead of when the credentials expire.

## New endpoint

`POST /api/v1/sessions/:id/aws` — auth: `X-API-Key` (must own the session)

```json
{ "service": "s3", "action": "GetObject", "params": { "Bucket": "demo-bucket", "Key": "reports/q3.csv" } }
```

Processing:

1. Authenticate the agent; the session must belong to it and be `active` (else 404 / 409).
2. Work out the target ARN from `service` + `params` (e.g. S3 `Bucket` + `Key` → `arn:aws:s3:::demo-bucket/reports/q3.csv`).
3. Allow only if `service:action` on that ARN matches one of the session's granted permissions (same matcher as
   `lib/validation/permission-validator.ts`). Otherwise `403` and write a `policy.violated` audit entry (critical).
4. Make the call with the session's STS credentials (decrypt from `tokens`), using the AWS SDK v3 client for the service.
5. Return `{ data: { result } }`. For large S3 objects return a presigned URL (`{ data: { url, expiresAt } }`) rather than
   streaming the body through the server.
6. Audit-log every call: `aws.call` (new action) with service, action, ARN, status. Increment `sessions.usageCount`.

Response codes: 200, 400 (unsupported service/action or bad params), 401, 403 (outside grant — logged), 404, 409.

## Scope for the first version

Start with an allow-list of actions, implemented explicitly:

| Service | Actions |
|---|---|
| s3 | GetObject (presigned URL), PutObject (presigned URL), ListObjectsV2, HeadObject |
| dynamodb | GetItem, Query, DescribeTable |
| logs | FilterLogEvents, GetLogEvents |

Anything else returns `400 UNSUPPORTED_ACTION`. A general AWS-compatible SigV4 re-signing proxy
(`AWS_ENDPOINT_URL=https://<domain>/aws`) is the long-term option so the normal AWS CLI/SDKs work unchanged.

## Other changes

- `POST /api/v1/sessions` should stop returning `credentials` (keep them server-side only). Keep an opt-in only if
  some integration truly needs raw credentials.
- Add `aws.call` to the audit action enum (`types/models.ts`, `audit-log.model.ts`).
- The dashboard's create-session dialog currently shows raw credentials; update it to match once this ships.
