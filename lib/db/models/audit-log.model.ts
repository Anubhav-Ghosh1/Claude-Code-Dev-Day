import mongoose, { Schema, Document, Model } from 'mongoose';
import type { AuditAction, AuditSeverity, ActorType } from '@/types/models';

export interface IAuditLog extends Document {
  logId: string;
  sequenceNumber: number;
  sessionId?: string;
  agentId?: string;
  actorType: ActorType;
  actorId: string;
  action: AuditAction;
  severity: AuditSeverity;
  details: Record<string, unknown>;
  previousHash: string;
  hash: string;
  timestamp: Date;
  sourceIp?: string;
  userAgent?: string;
}

const AUDIT_ACTIONS: AuditAction[] = [
  'agent.registered', 'agent.suspended', 'agent.revoked',
  'session.created', 'session.completed', 'session.revoked', 'session.expired',
  'credentials.issued', 'credentials.rotated', 'credentials.revoked',
  'escalation.requested', 'escalation.approved', 'escalation.partially_approved', 'escalation.denied',
  'permission.granted', 'permission.denied',
  'policy.created', 'policy.updated', 'policy.disabled', 'policy.violated',
  'overprivilege.detected',
  'integrity.check.passed', 'integrity.check.failed',
];

const AuditLogSchema = new Schema<IAuditLog>(
  {
    logId: { type: String, required: true, unique: true },
    sequenceNumber: { type: Number, required: true, unique: true },
    sessionId: { type: String, index: true },
    agentId: { type: String, index: true },
    actorType: { type: String, enum: ['agent', 'system', 'dashboard_user'], required: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true, enum: AUDIT_ACTIONS, index: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },
    details: { type: Schema.Types.Mixed, required: true },
    previousHash: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    sourceIp: String,
    userAgent: String,
  },
  { timestamps: false }
);

// Block all mutation operations
const immutableOps = [
  'updateOne', 'updateMany', 'findOneAndUpdate',
  'deleteOne', 'deleteMany', 'findOneAndDelete',
  'findOneAndReplace', 'replaceOne',
] as const;

for (const op of immutableOps) {
  AuditLogSchema.pre(op, function () {
    throw new Error('Audit logs are immutable. Update and delete operations are forbidden.');
  });
}

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ agentId: 1, timestamp: -1 });
AuditLogSchema.index({ sessionId: 1, sequenceNumber: 1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
