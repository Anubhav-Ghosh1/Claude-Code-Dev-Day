#!/usr/bin/env bash
# Seeds demo data through the real API: policies, agents, and a few sessions.
# Usage: npm run dev, then  ./scripts/seed-demo.sh [base-url]
set -euo pipefail
BASE="${1:-http://localhost:3000}/api/v1"
post() { curl -s -X POST "$BASE$1" -H 'Content-Type: application/json' "${@:3}" -d "$2"; }
json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }

echo "→ policies"
post /policies '{"name":"security-baseline","description":"Hard deny on identity and account-level actions.","priority":100,
  "rules":[{"effect":"deny","services":["iam","sts","organizations"],"actions":["*"],"resources":["*"]}]}' >/dev/null
post /policies '{"name":"s3-data-access","description":"Object access on demo and data-lake buckets.","priority":10,
  "rules":[{"effect":"allow","services":["s3"],"actions":["GetObject","ListBucket","PutObject","DeleteObject"],"resources":["arn:aws:s3:::demo-bucket","arn:aws:s3:::demo-bucket/*","arn:aws:s3:::data-lake/*"]}]}' >/dev/null
post /policies '{"name":"readonly-observability","description":"Read-only DynamoDB and CloudWatch Logs.","priority":10,
  "rules":[{"effect":"allow","services":["dynamodb"],"actions":["GetItem","Query","DescribeTable"],"resources":["arn:aws:dynamodb:*:*:table/*"]},
           {"effect":"allow","services":["logs"],"actions":["FilterLogEvents","GetLogEvents"],"resources":["arn:aws:logs:*:*:log-group:*"]}]}' >/dev/null

agent() { post /agents "{\"name\":\"$1\",\"description\":\"$2\",\"metadata\":{\"team\":\"$3\"}}" | json "['data']['apiKey']"; }
echo "→ agents"
S3=$(agent s3-reader-agent "Reads and summarizes documents from S3" analytics)
SUP=$(agent support-triage-agent "Looks up tickets and drafts replies" cx)
LOGS=$(agent log-analyzer-agent "Investigates incidents from CloudWatch logs" sre)

session() { post /sessions "$2" -H "X-API-Key: $1"; }
sid() { json "['data']['sessionId']"; }
echo "→ sessions"
A=$(session "$S3" '{"gist":"Read reports/q3-revenue.csv from demo-bucket and summarize key trends","estimatedDuration":900,"permissions":[
  {"service":"s3","action":"GetObject","resource":"arn:aws:s3:::demo-bucket/reports/*"},
  {"service":"s3","action":"DeleteObject","resource":"arn:aws:s3:::demo-bucket/*"}]}' | sid)
B=$(session "$SUP" '{"gist":"Look up ticket #48213 and draft a reply to the customer","estimatedDuration":600,"permissions":[
  {"service":"dynamodb","action":"GetItem","resource":"arn:aws:dynamodb:us-east-1:123456789012:table/tickets"},
  {"service":"dynamodb","action":"Scan","resource":"arn:aws:dynamodb:us-east-1:123456789012:table/customers"}]}' | sid)
C=$(session "$LOGS" '{"gist":"Investigate the 5xx spike on checkout-api in the last 2 hours","estimatedDuration":900,"permissions":[
  {"service":"logs","action":"FilterLogEvents","resource":"arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/checkout"},
  {"service":"iam","action":"PassRole","resource":"arn:aws:iam::123456789012:role/lambda-exec"}]}' | sid)
D=$(session "$S3" '{"gist":"List objects under reports/ and generate an index page","estimatedDuration":300,"permissions":[
  {"service":"s3","action":"ListBucket","resource":"arn:aws:s3:::demo-bucket"},
  {"service":"s3","action":"PutObject","resource":"arn:aws:s3:::demo-bucket/index/*"}]}' | sid)

post "/sessions/$A/complete" '{"summary":"Summary delivered — 12 insights, no writes needed"}' -H "X-API-Key: $S3" >/dev/null
post "/sessions/$C/revoke" '{"reason":"Requested iam:PassRole during an investigation"}' >/dev/null
echo "✓ seeded — active: $B $D"
