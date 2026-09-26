import { z } from 'zod';
import { MAX_GIST_LENGTH, MAX_SESSION_TTL } from '@/lib/utils/constants';

const arnPattern = /^arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:\d{0,12}:[\w+\/:.@*-]+$/;

export const permissionEntrySchema = z.object({
  service: z.string().min(1).max(64),
  action: z.string().min(1).max(128),
  resource: z.string().min(1).max(2048).regex(arnPattern, 'Invalid ARN format'),
  effect: z.enum(['Allow', 'Deny']).default('Allow'),
  conditions: z.record(z.unknown()).optional(),
});

export const createSessionSchema = z.object({
  gist: z.string().min(1).max(MAX_GIST_LENGTH),
  permissions: z.array(permissionEntrySchema).min(1).max(50),
  estimatedDuration: z.number().int().min(60).max(MAX_SESSION_TTL),
});

export const escalateSessionSchema = z.object({
  additionalPermissions: z.array(permissionEntrySchema).min(1).max(20),
  reason: z.string().min(1).max(1024),
});

export const completeSessionSchema = z.object({
  summary: z.string().max(4096).optional(),
}).optional();

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  metadata: z.record(z.string()).optional(),
  policyIds: z.array(z.string()).optional(),
  rateLimit: z.object({
    maxRequestsPerMinute: z.number().int().min(1).max(1000).optional(),
    maxActiveSessions: z.number().int().min(1).max(100).optional(),
  }).optional(),
});

export const policyRuleSchema = z.object({
  effect: z.enum(['allow', 'deny']),
  services: z.array(z.string().min(1)).min(1),
  actions: z.array(z.string().min(1)).min(1),
  resources: z.array(z.string().min(1)).min(1),
  conditions: z.record(z.unknown()).optional(),
});

export const createPolicySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional(),
  rules: z.array(policyRuleSchema).min(1),
  scope: z.object({
    agentIds: z.array(z.string()).optional(),
    agentMetadata: z.record(z.string()).optional(),
  }).optional(),
  constraints: z.object({
    maxSessionDuration: z.number().int().min(60).max(43200).optional(),
    maxEscalationsPerSession: z.number().int().min(0).max(10).optional(),
    maxConcurrentSessions: z.number().int().min(1).max(100).optional(),
    allowedRegions: z.array(z.string()).optional(),
  }).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
});

export const updatePolicySchema = createPolicySchema.partial();
