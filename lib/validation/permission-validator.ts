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
      const { suggestion, suggestedPermission } = buildSuggestion(perm, denyReason, applicablePolicies);
      denied.push({
        permission: perm,
        reason: denyReason,
        policyId: denyPolicyId || undefined,
        suggestion,
        suggestedPermission,
      });
    }
  }

  return { granted, denied };
}

function buildSuggestion(
  perm: PermissionEntry,
  reason: string,
  policies: IPolicy[]
): { suggestion: string; suggestedPermission?: PermissionEntry } {
  if (perm.resource === '*' || perm.resource === 'arn:aws:s3:::*') {
    return {
      suggestion: `Resource "${perm.resource}" is too broad. Use a specific ARN like "arn:aws:${perm.service}:us-east-1:123456789012:*" or "arn:aws:s3:::my-bucket/*". Retry with a scoped resource.`,
      suggestedPermission: {
        ...perm,
        resource: `arn:aws:${perm.service}:us-east-1:*:*`,
      },
    };
  }

  if (perm.action === '*') {
    const allowedActions = findAllowedActions(perm.service, policies);
    if (allowedActions.length > 0) {
      return {
        suggestion: `Wildcard action "*" denied. For ${perm.service}, try specific actions: ${allowedActions.join(', ')}. Retry with one of these actions.`,
        suggestedPermission: {
          ...perm,
          action: allowedActions[0],
        },
      };
    }
    return {
      suggestion: `Wildcard action "*" on ${perm.service} is denied. Request specific actions like "GetItem", "PutObject", "CreateFunction" etc.`,
    };
  }

  if (reason.includes('Explicitly denied by policy')) {
    return {
      suggestion: `"${perm.service}:${perm.action}" is explicitly blocked by policy. This service/action combination is not allowed. Choose a different service or action that is permitted.`,
    };
  }

  const allowedServices = findAllowedServices(policies);
  if (allowedServices.length > 0) {
    return {
      suggestion: `No allow policy matches "${perm.service}:${perm.action}". Allowed services: ${allowedServices.join(', ')}. Request permissions within these services, using specific ARNs (not wildcards).`,
    };
  }

  return {
    suggestion: `No policy allows "${perm.service}:${perm.action}" on "${perm.resource}". Ask your admin to create an allow policy, or check that your resource ARN is specific (not a bare wildcard).`,
  };
}

function findAllowedActions(service: string, policies: IPolicy[]): string[] {
  const actions = new Set<string>();
  for (const p of policies) {
    for (const r of p.rules) {
      if (r.effect !== 'allow') continue;
      if (r.services.some(s => matchesGlob(service, s))) {
        for (const a of r.actions) {
          if (a !== '*') actions.add(a);
        }
      }
    }
  }
  return [...actions].slice(0, 5);
}

function findAllowedServices(policies: IPolicy[]): string[] {
  const services = new Set<string>();
  for (const p of policies) {
    for (const r of p.rules) {
      if (r.effect !== 'allow') continue;
      for (const s of r.services) {
        if (s !== '*') services.add(s);
      }
    }
  }
  return [...services].slice(0, 8);
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
