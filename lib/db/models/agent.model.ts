import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgent extends Document {
  agentId: string;
  name: string;
  description?: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  assignedPolicies: mongoose.Types.ObjectId[];
  metadata: Record<string, string>;
  rateLimit: {
    maxRequestsPerMinute: number;
    maxActiveSessions: number;
  };
  status: 'active' | 'suspended' | 'revoked';
  lastActiveAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    agentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, maxlength: 128 },
    description: { type: String, maxlength: 512 },
    apiKeyHash: { type: String, required: true },
    apiKeyPrefix: { type: String, required: true, index: true },
    assignedPolicies: [{ type: Schema.Types.ObjectId, ref: 'Policy' }],
    metadata: { type: Schema.Types.Mixed, default: {} },
    rateLimit: {
      maxRequestsPerMinute: { type: Number, default: 30 },
      maxActiveSessions: { type: Number, default: 5 },
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked'],
      default: 'active',
      index: true,
    },
    lastActiveAt: Date,
    createdBy: String,
  },
  { timestamps: true }
);

AgentSchema.index({ status: 1, createdAt: -1 });

export const Agent: Model<IAgent> =
  mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);
