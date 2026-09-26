import { Policy, IPolicy, IPolicyRule } from '@/lib/db/models/policy.model';
import { arnMatchesPattern } from '@/lib/aws/arn-validator';
import type { PermissionEntry, DeniedPermission } from '@/types/models';

interface ValidationResult {
  granted: PermissionEntry[];
  denied: DeniedPermission[];
}

function matchesGlob(value: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`, 'i').test(value);
}

function ruleMatchesPermission(rule: IPolicyRule, perm: PermissionEntry): boolean {
  const serviceMatch = rule.services.some((s) => matchesGlob(perm.service, s));
  if (!serviceMatch) return false;

  const actionMatch = rule.actions.some((a) => matchesGlob(perm.action, a));
  if (!actionMatch) return false;

  const resourceMatch = rule.resources.some((r) => arnMatchesPattern(perm.resource, r));
  return resourceMatch;
}

export async function validatePermissions(
  agentId: string,
  agentMetadata: Record<string, string>,
  requestedPermissions: PermissionEntry[]
): Promise<ValidationResult> {
  const policies = await Policy.find({ status: 'active' }).sort({ priority: -1 });

  const applicablePolicies = policies.filter((policy) => {
    if (policy.scope.agentIds.length > 0 && !policy.scope.agentIds.includes(agentId)) {
      return false;
    }
    if (policy.scope.agentMetadata && policy.scope.agentMetadata.size > 0) {
      for (const [key, value] of policy.scope.agentMetadata) {
        if (agentMetadata[key] !== value) return false;
      }
    }
    return true;
  });

  const granted: PermissionEntry[] = [];
  const denied: DeniedPermission[] = [];

  for (const perm of requestedPermissions) {
    let decision: 'granted' | 'denied' = 'denied';
    let denyReason = 'No matching allow policy found';
    let denyPolicyId = '';

    for (const policy of applicablePolicies) {
      for (const rule of policy.rules) {
        if (!ruleMatchesPermission(rule, perm)) continue;

        if (rule.effect === 'deny') {
          decision = 'denied';
          denyReason = `Explicitly denied by policy '${policy.name}'`;
          denyPolicyId = policy.policyId;
          break;
        }

        if (rule.effect === 'allow' && decision !== 'denied') {
          decision = 'granted';
        }

        if (rule.effect === 'allow') {
          decision = 'granted';
        }
      }

      // Explicit deny found — stop evaluating further policies
      if (denyPolicyId) break;
    }

    if (decision === 'granted') {
      granted.push(perm);
    } else {
      denied.push({
        permission: perm,
        reason: denyReason,
        policyId: denyPolicyId || undefined,
      });
    }
  }

  return { granted, denied };
}

export function getMaxSessionDuration(policies: IPolicy[]): number {
  let maxDuration = 3600;
  for (const policy of policies) {
    if (policy.constraints.maxSessionDuration) {
      maxDuration = Math.min(maxDuration, policy.constraints.maxSessionDuration);
    }
  }
  return maxDuration;
}

export function getMaxEscalations(policies: IPolicy[]): number {
  let maxEsc = 3;
  for (const policy of policies) {
    if (policy.constraints.maxEscalationsPerSession !== undefined) {
      maxEsc = Math.min(maxEsc, policy.constraints.maxEscalationsPerSession);
    }
  }
  return maxEsc;
}
