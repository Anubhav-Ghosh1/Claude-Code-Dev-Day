import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connection';
import { User } from '@/lib/db/models/user.model';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { BadRequestError, ConflictError } from '@/lib/errors/api-errors';

const registerSchema = z.object({
  email: z.string().email().max(256),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(128),
  role: z.enum(['admin', 'auditor', 'viewer']).default('viewer'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await connectDB();

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ConflictError(`User with email ${email} already exists`);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({
      email,
      passwordHash,
      name: parsed.data.name,
      role: parsed.data.role,
      status: 'active',
    });

    return successResponse({
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
