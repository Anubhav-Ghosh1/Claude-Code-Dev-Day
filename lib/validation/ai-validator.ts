import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
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

const PermissionSchema = z.object({
  service: z.string(),
  action: z.string(),
  resource: z.string(),
  effect: z.enum(['Allow', 'Deny']),
});

const VerdictSchema = z.object({
  approved: z.boolean(),
  reasoning: z.string(),
  flaggedPermissions: z.array(
    PermissionSchema.extend({
      concern: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    })
  ),
  suggestedPermissions: z.array(PermissionSchema),
  confidenceScore: z.number(),
});

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

  const message = await anthropic.messages.parse({
    model: AI_MODEL,
    max_tokens: 4096,
    output_config: { format: zodOutputFormat(VerdictSchema) },
    messages: [
      {
        role: 'user',
        content: `You are an AWS security auditor. An AI agent has declared the following intent and requested AWS permissions. Evaluate whether the requested permissions are actually necessary for the stated intent.

## Agent's Intent (Gist)
${gist}

## Requested Permissions
${permissionsList}

Rules:
- Flag permissions that seem unrelated to the stated intent, with a concern and severity for each
- Flag overly broad resources (wildcards) when narrower scopes would work
- Flag high-risk services (iam, sts, organizations) unless clearly justified
- suggestedPermissions should contain a narrower/corrected set if you flagged issues, otherwise an empty list
- approved=true means the permissions are reasonable for the intent
- confidenceScore is between 0 and 1 and reflects how certain you are in your assessment`,
      },
    ],
  });

  const verdict = message.parsed_output;
  if (!verdict) {
    // Fail closed: an unusable response must never read as an approval.
    return {
      approved: false,
      reasoning: `AI validation returned no usable verdict (stop_reason: ${message.stop_reason}) — flagged for manual review`,
      flaggedPermissions: [],
      confidenceScore: 0,
    };
  }

  return {
    approved: verdict.approved,
    reasoning: verdict.reasoning,
    flaggedPermissions: verdict.flaggedPermissions.map(
      ({ concern, severity, ...permission }) => ({ permission, concern, severity })
    ),
    suggestedPermissions: verdict.suggestedPermissions,
    confidenceScore: Math.min(1, Math.max(0, verdict.confidenceScore)),
  };
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
