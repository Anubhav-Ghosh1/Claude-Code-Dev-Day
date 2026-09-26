import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IToken extends Document {
  tokenId: string;
  sessionId: string;
  agentId: string;
  accessKeyId: string;
  encryptedSecretKey: string;
  encryptedSessionToken: string;
  encryptionKeyId: string;
  iv: string;
  authTag: string;
  roleArn: string;
  inlinePolicy: Record<string, unknown>;
  status: 'active' | 'revoked' | 'expired';
  issuedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  supersededBy?: string;
}

const TokenSchema = new Schema<IToken>(
  {
    tokenId: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, index: true },
    agentId: { type: String, required: true, index: true },
    accessKeyId: { type: String, required: true, index: true },
    encryptedSecretKey: { type: String, required: true },
    encryptedSessionToken: { type: String, required: true },
    encryptionKeyId: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    roleArn: { type: String, required: true },
    inlinePolicy: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active',
      index: true,
    },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    supersededBy: String,
  },
  { timestamps: false }
);

TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2592000 });
TokenSchema.index({ status: 1, expiresAt: 1 });

export const Token: Model<IToken> =
  mongoose.models.Token || mongoose.model<IToken>('Token', TokenSchema);
