import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Policy } from '@/lib/db/models/policy.model';
import { updatePolicySchema } from '@/lib/validation/schemas';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { writeAuditLog } from '@/lib/audit/logger';
import { BadRequestError, NotFoundError } from '@/lib/errors/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const policy = await Policy.findOne({ policyId: id });
    if (!policy) throw new NotFoundError('Policy', id);
    return successResponse(policy);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const parsed = updatePolicySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Validation failed', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    await connectDB();
    const { id } = await params;
    const policy = await Policy.findOne({ policyId: id });
    if (!policy) throw new NotFoundError('Policy', id);

    Object.assign(policy, parsed.data);
    policy.version += 1;
    await policy.save();

    await writeAuditLog({
      actorType: 'system',
      actorId: 'system',
      action: 'policy.updated',
      severity: 'info',
      details: { policyId: id, version: policy.version, changes: Object.keys(parsed.data) },
    });

    return successResponse(policy);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const policy = await Policy.findOne({ policyId: id });
    if (!policy) throw new NotFoundError('Policy', id);

    policy.status = 'disabled';
    await policy.save();

    await writeAuditLog({
      actorType: 'system',
      actorId: 'system',
      action: 'policy.disabled',
      severity: 'info',
      details: { policyId: id, name: policy.name },
    });

    return successResponse({ message: 'Policy disabled', policyId: id });
  } catch (error) {
    return errorResponse(error);
  }
}
