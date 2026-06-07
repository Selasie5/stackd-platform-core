import type { GraphQLContext } from '@/graphql/context';
import { authError } from '@/auth/errors';
import type { SessionData, UserRole } from '@/auth/types';

export function requireAuth(ctx: GraphQLContext): SessionData {
  if (!ctx.session) {
    throw authError('UNAUTHENTICATED', 'You must be logged in');
  }
  return ctx.session;
}

export function requireRole(ctx: GraphQLContext, roles: UserRole[]): SessionData {
  const session = requireAuth(ctx);
  if (!roles.includes(session.role)) {
    throw authError('FORBIDDEN', 'You do not have permission to perform this action');
  }
  return session;
}

export function requireEmailVerified(ctx: GraphQLContext): SessionData {
  const session = requireAuth(ctx);
  if (!session.emailVerified) {
    throw authError('EMAIL_NOT_VERIFIED', 'Please verify your email before continuing');
  }
  return session;
}
