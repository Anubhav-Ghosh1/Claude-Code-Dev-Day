import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/next-auth-options';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { UnauthorizedError } from '@/lib/errors/api-errors';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new UnauthorizedError('Not authenticated');

    return successResponse({
      email: session.user.email,
      name: session.user.name,
      role: (session.user as { role?: string }).role || 'viewer',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
