import type { PermissionEntry } from '@/types/models';

interface IAMStatement {
  Effect: 'Allow' | 'Deny';
  Action: string[];
  Resource: string[];
  Condition?: Record<string, unknown>;
}

interface IAMPolicyDocument {
  Version: '2012-10-17';
  Statement: IAMStatement[];
}

export function buildPolicyDocument(permissions: PermissionEntry[]): IAMPolicyDocument {
  const statementMap = new Map<string, IAMStatement>();

  for (const perm of permissions) {
    const key = `${perm.effect}-${JSON.stringify(perm.conditions || {})}`;

    if (!statementMap.has(key)) {
      statementMap.set(key, {
        Effect: perm.effect,
        Action: [],
        Resource: [],
        ...(perm.conditions && { Condition: perm.conditions }),
      });
    }

    const stmt = statementMap.get(key)!;
    const action = `${perm.service}:${perm.action}`;
    if (!stmt.Action.includes(action)) stmt.Action.push(action);
    if (!stmt.Resource.includes(perm.resource)) stmt.Resource.push(perm.resource);
  }

  const doc: IAMPolicyDocument = {
    Version: '2012-10-17',
    Statement: Array.from(statementMap.values()),
  };

  const packed = JSON.stringify(doc);
  if (packed.length > 2048) {
    throw new Error(
      `Policy document exceeds STS inline policy limit (${packed.length}/2048 chars). Narrow resource patterns or reduce permissions.`
    );
  }

  return doc;
}

export function getPolicyDocumentSize(permissions: PermissionEntry[]): number {
  const doc = buildPolicyDocument(permissions);
  return JSON.stringify(doc).length;
}
