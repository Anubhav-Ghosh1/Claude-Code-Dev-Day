import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  return NextResponse.json({
    data: {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        aws_sts: process.env.USE_MOCK_STS === 'true' ? 'mock' : process.env.AWS_TARGET_ROLE_ARN ? 'configured' : 'not_configured',
        ai_validation: process.env.ENABLE_AI_VALIDATION === 'true' && process.env.ANTHROPIC_API_KEY ? 'enabled' : 'disabled',
      },
    },
  });
}
