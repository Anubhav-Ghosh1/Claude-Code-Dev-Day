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
        aws_sts: process.env.AWS_TARGET_ROLE_ARN ? 'configured' : 'not_configured',
      },
    },
  });
}
