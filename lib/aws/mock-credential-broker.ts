import { nanoid } from 'nanoid';
import { buildPolicyDocument } from './policy-document-builder';
import { encrypt } from '@/lib/crypto/encryption';
import type { PermissionEntry } from '@/types/models';
import type { BrokerResult } from './credential-broker';

export async function issueMockCredentials(
  sessionId: string,
  agentId: string,
  grantedPermissions: PermissionEntry[],
  durationSeconds: number
): Promise<BrokerResult> {
  const policyDocument = buildPolicyDocument(grantedPermissions);
  const roleArn = process.env.AWS_TARGET_ROLE_ARN || 'arn:aws:iam::000000000000:role/MockRole';

  const mockAccessKeyId = `ASIAMOCK${nanoid(12).toUpperCase()}`;
  const mockSecretKey = `mock-secret-${nanoid(40)}`;
  const mockSessionToken = `mock-session-token-${nanoid(64)}`;

  const encSecret = encrypt(mockSecretKey);
  const encToken = encrypt(mockSessionToken);

  return {
    accessKeyId: mockAccessKeyId,
    secretAccessKey: mockSecretKey,
    sessionToken: mockSessionToken,
    expiration: new Date(Date.now() + durationSeconds * 1000),
    roleArn,
    encryptedSecretKey: encSecret.ciphertext,
    encryptedSessionToken: encToken.ciphertext,
    iv: encSecret.iv,
    authTag: encSecret.authTag,
    encryptionKeyId: encSecret.keyId,
    inlinePolicy: policyDocument as unknown as Record<string, unknown>,
  };
}
