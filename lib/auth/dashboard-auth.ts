import { getServerSession } from 'next-auth';
import { authOptions } from './next-auth-options';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors/api-errors';
import type { UserRole } from '@/types/models';
import { hasPermission } from './rbac';

export interface DashboardUser {
  email: string;
  name: string;
  role: UserRole;
}

export async function requireDashboardAuth(permission?: string): Promise<DashboardUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new UnauthorizedError('Dashboard authentication required');
  }

  const user: DashboardUser = {
    email: session.user.email!,
    name: session.user.name!,
    role: (session.user as { role?: UserRole }).role || 'viewer',
  };

  if (permission && !hasPermission(user.role, permission)) {
    throw new ForbiddenError(`Insufficient permissions: requires '${permission}'`);
  }

  return user;
}
