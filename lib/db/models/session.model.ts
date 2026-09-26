import mongoose, { Schema, Document, Model } from 'mongoose';

const PermissionEntrySchema = new Schema(
  {
    service: { type: String, required: true },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    effect: { type: String, enum: ['Allow', 'Deny'], default: 'Allow' },
    conditions: Schema.Types.Mixed,
  },
  { _id: false }
);

const DeniedPermissionSchema = new Schema(
  {
    permission: { type: PermissionEntrySchema, required: true },
    reason: { type: String, required: true },
    policyId: String,
  },
  { _id: false }
);

const EscalationSchema = new Schema(
  {
    escalationId: { type: String, required: true },
    requestedAt: { type: Date, required: true },
    reason: { type: String, required: true, maxlength: 1024 },
    requestedPermissions: [PermissionEntrySchema],
    status: {
      type: String,
      enum: ['approved', 'partially_approved', 'denied'],
      required: true,
    },
    grantedPermissions: [PermissionEntrySchema],
    deniedPermissions: [DeniedPermissionSchema],
    evaluatedByPolicy: String,
    resolvedAt: Date,
  },
  { _id: false }
);

const OverPrivilegeFlagSchema = new Schema(
  {
    permission: { type: PermissionEntrySchema, required: true },
    reason: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], required: true },
  },
  { _id: false }
);

export interface ISession extends Document {
  sessionId: string;
  agentId: string;
  gist: string;
  status: 'active' | 'completed' | 'revoked' | 'expired';
  requestedPermissions: Array<{
    service: string;
    action: string;
    resource: string;
    effect: 'Allow' | 'Deny';
    conditions?: Record<string, unknown>;
  }>;
  grantedPermissions: Array<{
    service: string;
    action: string;
    resource: string;
    effect: 'Allow' | 'Deny';
    conditions?: Record<string, unknown>;
  }>;
  deniedPermissions: Array<{
    permission: {
      service: string;
      action: string;
      resource: string;
      effect: 'Allow' | 'Deny';
      conditions?: Record<string, unknown>;
    };
    reason: string;
    policyId?: string;
  }>;
  escalations: Array<{
    escalationId: string;
    requestedAt: Date;
    reason: string;
    requestedPermissions: Array<{
      service: string;
      action: string;
      resource: string;
      effect: 'Allow' | 'Deny';
    }>;
    status: 'approved' | 'partially_approved' | 'denied';
    grantedPermissions: Array<{
      service: string;
      action: string;
      resource: string;
      effect: 'Allow' | 'Deny';
    }>;
    deniedPermissions: Array<{
      permission: {
        service: string;
        action: string;
        resource: string;
        effect: 'Allow' | 'Deny';
      };
      reason: string;
    }>;
    evaluatedByPolicy?: string;
    resolvedAt?: Date;
  }>;
  credentialRef?: {
    tokenId: string;
    roleArn: string;
    accessKeyId: string;
    expiration: Date;
  };
  estimatedDuration: number;
  ttl: {
    issuedAt?: Date;
    expiresAt?: Date;
    actualDuration?: number;
  };
  usageCount: number;
  overPrivilegeScore?: number;
  overPrivilegeFlags: Array<{
    permission: {
      service: string;
      action: string;
      resource: string;
      effect: 'Allow' | 'Deny';
      conditions?: Record<string, unknown>;
    };
    reason: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  aiValidation?: {
    approved: boolean;
    reasoning: string;
    flaggedPermissions: Array<{
      permission: { service: string; action: string; resource: string; effect: 'Allow' | 'Deny' };
      concern: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    suggestedPermissions?: Array<{ service: string; action: string; resource: string; effect: 'Allow' | 'Deny' }>;
    confidenceScore: number;
    model: string;
  };
  completedAt?: Date;
  revokedAt?: Date;
  revocationReason?: string;
  auditChainHead?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    agentId: { type: String, required: true, index: true },
    gist: { type: String, required: true, maxlength: 4096 },
    status: {
      type: String,
      enum: ['active', 'completed', 'revoked', 'expired'],
      default: 'active',
      index: true,
    },
    requestedPermissions: [PermissionEntrySchema],
    grantedPermissions: [PermissionEntrySchema],
    deniedPermissions: [DeniedPermissionSchema],
    escalations: [EscalationSchema],
    credentialRef: {
      tokenId: String,
      roleArn: String,
      accessKeyId: String,
      expiration: Date,
    },
    estimatedDuration: { type: Number, required: true, max: 43200 },
    ttl: {
      issuedAt: Date,
      expiresAt: { type: Date, index: true },
      actualDuration: Number,
    },
    usageCount: { type: Number, default: 0 },
    overPrivilegeScore: { type: Number, min: 0, max: 1 },
    overPrivilegeFlags: [OverPrivilegeFlagSchema],
    aiValidation: Schema.Types.Mixed,
    completedAt: Date,
    revokedAt: Date,
    revocationReason: String,
    auditChainHead: String,
  },
  { timestamps: true }
);

SessionSchema.index({ status: 1, createdAt: -1 });
SessionSchema.index({ agentId: 1, status: 1 });
SessionSchema.index({ 'ttl.expiresAt': 1, status: 1 });

export const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
