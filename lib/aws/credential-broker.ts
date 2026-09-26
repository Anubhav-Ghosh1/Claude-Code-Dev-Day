import { AssumeRoleCommand } from '@aws-sdk/client-sts';
import { getSTSClient } from './sts-client';
import { buildPolicyDocument } from './policy-document-builder';
import { encrypt } from '@/lib/crypto/encryption';
import type { PermissionEntry } from '@/types/models';

export interface BrokerResult {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
  roleArn: string;
  encryptedSecretKey: string;
  encryptedSessionToken: string;
  iv: string;
  authTag: string;
  encryptionKeyId: string;
  inlinePolicy: Record<string, unknown>;
}

export async function issueCredentials(
  sessionId: string,
  agentId: string,
  grantedPermissions: PermissionEntry[],
  durationSeconds: number
): Promise<BrokerResult> {
  const targetRoleArn = process.env.AWS_TARGET_ROLE_ARN;
  if (!targetRoleArn) throw new Error('AWS_TARGET_ROLE_ARN not configured');

  const policyDocument = buildPolicyDocument(grantedPermissions);
  const sts = getSTSClient();

  const command = new AssumeRoleCommand({
    RoleArn: targetRoleArn,
    RoleSessionName: `av-${sessionId.substring(0, 54)}`,
    Policy: JSON.stringify(policyDocument),
    DurationSeconds: Math.min(durationSeconds, 43200),
    ExternalId: process.env.AWS_EXTERNAL_ID || 'agentvault-broker',
    Tags: [
      { Key: 'agentId', Value: agentId },
      { Key: 'sessionId', Value: sessionId },
      { Key: 'source', Value: 'agentvault' },
    ],
  });

  const response = await sts.send(command);
  const creds = response.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
    throw new Error('STS AssumeRole returned incomplete credentials');
  }

  const encSecret = encrypt(creds.SecretAccessKey);
  const encToken = encrypt(creds.SessionToken);

  return {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration || new Date(Date.now() + durationSeconds * 1000),
    roleArn: targetRoleArn,
    encryptedSecretKey: encSecret.ciphertext,
    encryptedSessionToken: encToken.ciphertext,
    iv: encSecret.iv,
    authTag: encSecret.authTag,
    encryptionKeyId: encSecret.keyId,
    inlinePolicy: policyDocument as unknown as Record<string, unknown>,
  };
}
