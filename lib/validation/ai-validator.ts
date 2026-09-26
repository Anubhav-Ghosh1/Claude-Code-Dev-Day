import Anthropic from '@anthropic-ai/sdk';
import type { PermissionEntry } from '@/types/models';

export const AI_MODEL = 'claude-sonnet-5';

export interface AIValidationResult {
  approved: boolean;
  reasoning: string;
  flaggedPermissions: Array<{
    permission: PermissionEntry;
    concern: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  suggestedPermissions?: PermissionEntry[];
  confidenceScore: number;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function validateWithAI(
  gist: string,
  permissions: PermissionEntry[]
): Promise<AIValidationResult> {
  const anthropic = getClient();

  const permissionsList = permissions
    .map((p) => `- ${p.service}:${p.action} on ${p.resource} (${p.effect})`)
    .join('\n');

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an AWS security auditor. An AI agent has declared the following intent and requested AWS permissions. Evaluate whether the requested permissions are actually necessary for the stated intent.

## Agent's Intent (Gist)
${gist}

## Requested Permissions
${permissionsList}

Analyze and respond with ONLY valid JSON (no markdown, no code fences):
{
  "approved": true/false,
  "reasoning": "Brief explanation of your assessment",
  "flaggedPermissions": [
    {
      "service": "service-name",
      "action": "action-name",
      "resource": "resource-arn",
      "effect": "Allow",
      "concern": "Why this permission seems unnecessary or risky",
      "severity": "low|medium|high"
    }
  ],
  "suggestedPermissions": [
    {
      "service": "service-name",
      "action": "action-name",
      "resource": "narrower-resource-arn",
      "effect": "Allow"
    }
  ],
  "confidenceScore": 0.0-1.0
}

Rules:
- Flag permissions that seem unrelated to the stated intent
- Flag overly broad resources (wildcards) when narrower scopes would work
- Flag high-risk services (iam, sts, organizations) unless clearly justified
- suggestedPermissions should contain a narrower/corrected set if you flagged issues
- approved=true means the permissions are reasonable for the intent
- confidenceScore reflects how certain you are in your assessment`,
      },
    ],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const result = JSON.parse(text);

    return {
      approved: Boolean(result.approved),
      reasoning: String(result.reasoning || ''),
      flaggedPermissions: (result.flaggedPermissions || []).map(
        (f: Record<string, string>) => ({
          permission: {
            service: f.service,
            action: f.action,
            resource: f.resource,
            effect: (f.effect as 'Allow' | 'Deny') || 'Allow',
          },
          concern: f.concern,
          severity: f.severity as 'low' | 'medium' | 'high',
        })
      ),
      suggestedPermissions: result.suggestedPermissions?.map(
        (s: Record<string, string>) => ({
          service: s.service,
          action: s.action,
          resource: s.resource,
          effect: (s.effect as 'Allow' | 'Deny') || 'Allow',
        })
      ),
      confidenceScore: Number(result.confidenceScore) || 0.5,
    };
  } catch {
    return {
      approved: true,
      reasoning: 'AI validation response could not be parsed — defaulting to approve',
      flaggedPermissions: [],
      confidenceScore: 0,
    };
  }
}

/** Like validateWithAI, but returns null instead of throwing (bad key, outage, timeout). */
export async function tryValidateWithAI(
  gist: string,
  permissions: PermissionEntry[]
): Promise<AIValidationResult | null> {
  try {
    return await validateWithAI(gist, permissions);
  } catch (err) {
    console.warn('AI validation unavailable, continuing with policy decision only:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function isAIValidationEnabled(): boolean {
  return (
    process.env.ENABLE_AI_VALIDATION === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}
