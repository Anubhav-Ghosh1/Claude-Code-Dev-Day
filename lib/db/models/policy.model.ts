import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPolicyRule {
  effect: 'allow' | 'deny';
  services: string[];
  actions: string[];
  resources: string[];
  conditions?: Record<string, unknown>;
}

export interface IPolicy extends Document {
  policyId: string;
  name: string;
  description?: string;
  rules: IPolicyRule[];
  scope: {
    agentIds: string[];
    agentMetadata: Map<string, string>;
  };
  constraints: {
    maxSessionDuration: number;
    maxEscalationsPerSession: number;
    maxConcurrentSessions: number;
    allowedRegions: string[];
  };
  priority: number;
  status: 'active' | 'disabled';
  version: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PolicyRuleSchema = new Schema<IPolicyRule>(
  {
    effect: { type: String, enum: ['allow', 'deny'], required: true },
    services: [{ type: String, required: true }],
    actions: [{ type: String, required: true }],
    resources: [{ type: String, required: true }],
    conditions: Schema.Types.Mixed,
  },
  { _id: false }
);

const PolicySchema = new Schema<IPolicy>(
  {
    policyId: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 128 },
    description: { type: String, maxlength: 1024 },
    rules: {
      type: [PolicyRuleSchema],
      required: true,
      validate: [(val: IPolicyRule[]) => val.length > 0, 'At least one rule is required'],
    },
    scope: {
      agentIds: { type: [String], default: [] },
      agentMetadata: { type: Map, of: String, default: new Map() },
    },
    constraints: {
      maxSessionDuration: { type: Number, default: 3600 },
      maxEscalationsPerSession: { type: Number, default: 3 },
      maxConcurrentSessions: { type: Number, default: 5 },
      allowedRegions: { type: [String], default: [] },
    },
    priority: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    version: { type: Number, default: 1 },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
);

PolicySchema.index({ status: 1, priority: -1 });
PolicySchema.index({ 'scope.agentIds': 1 });

export const Policy: Model<IPolicy> =
  mongoose.models.Policy || mongoose.model<IPolicy>('Policy', PolicySchema);
