# AWS IAM Setup for AgentVault

When you're ready to switch from mock credentials to real AWS, follow this guide.

## Architecture

```
AgentVault (Broker)
  │
  │  sts:AssumeRole + inline session policy
  ▼
AWS STS
  │
  │  Returns scoped credentials
  ▼
Target Role (AgentWorkload-Staging)
  │
  │  Effective permissions = Target Role ∩ Inline Policy
  ▼
Agent uses credentials (Lambda, S3, DynamoDB, etc.)
```

## 1. Create the Target Role

This is the role agents will assume. Its permissions are the maximum ceiling — the inline policy further restricts.

```bash
aws iam create-role \
  --role-name AgentWorkload-Staging \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/AgentVaultBroker"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "agentvault-broker"
        }
      }
    }]
  }'
```

Attach permissions the agents might need (broad is OK — the inline policy narrows it):

```bash
aws iam attach-role-policy \
  --role-name AgentWorkload-Staging \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

## 2. Create the Broker Role (or IAM User)

### Option A: EC2/Lambda/Vercel (use IAM role or access keys)

For Vercel, create an IAM user with only `sts:AssumeRole`:

```bash
aws iam create-user --user-name agentvault-broker

aws iam put-user-policy \
  --user-name agentvault-broker \
  --policy-name AssumeAgentRoles \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::YOUR_ACCOUNT_ID:role/AgentWorkload-*"
    }]
  }'

aws iam create-access-key --user-name agentvault-broker
```

### Option B: EC2/ECS (use instance profile)

```bash
aws iam create-role \
  --role-name AgentVaultBroker \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam put-role-policy \
  --role-name AgentVaultBroker \
  --policy-name AssumeAgentRoles \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::YOUR_ACCOUNT_ID:role/AgentWorkload-*"
    }]
  }'
```

## 3. Configure Environment

```env
USE_MOCK_STS=false
AWS_REGION=us-east-1
AWS_TARGET_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/AgentWorkload-Staging
AWS_EXTERNAL_ID=agentvault-broker

# For Vercel (IAM user access keys):
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## 4. Multiple Environments

Create separate target roles per environment:

| Role | Purpose | Max Permissions |
|------|---------|-----------------|
| `AgentWorkload-Dev` | Development | Full access (dev account) |
| `AgentWorkload-Staging` | Staging | PowerUserAccess |
| `AgentWorkload-Prod` | Production | Restricted (read + specific writes) |

Set `AWS_TARGET_ROLE_ARN` per Vercel environment (Preview vs Production).

## Security Notes

- The **inline session policy** is the key security mechanism. Even if the target role has `PowerUserAccess`, the agent only gets the permissions AgentVault explicitly grants via the inline policy.
- STS session credentials cannot be individually revoked. AgentVault mitigates this with short TTLs (default 1 hour) and marks sessions as revoked in the database.
- All credential issuance is logged in the immutable audit chain.
- The broker IAM user/role should ONLY have `sts:AssumeRole` — nothing else.
