import type { GraphQLContext } from '@/graphql/context';
import { authError } from '@/auth/errors';
import { requireEmailVerified, requireRole } from '@/auth/guards';
import { getKycStatusForUser } from '@/kyc/kyc.service';
import { kycError } from '@/kyc/errors';
import type { SessionData } from '@/auth/types';

export async function requireKycApproved(ctx: GraphQLContext): Promise<SessionData> {
  const session = requireEmailVerified(ctx);
  const kycStatus = await getKycStatusForUser(session.userId, session.role);

  if (kycStatus !== 'approved') {
    throw kycError(
      'KYC_NOT_APPROVED',
      'KYC verification is required before performing this action',
    );
  }

  return session;
}

export async function requireBrandWriteAccess(ctx: GraphQLContext): Promise<SessionData> {
  requireRole(ctx, ['brand']);
  return requireKycApproved(ctx);
}

export async function requireCreatorApplyAccess(ctx: GraphQLContext): Promise<SessionData> {
  requireRole(ctx, ['creator']);
  return requireKycApproved(ctx);
}

export function requireAdmin(ctx: GraphQLContext): SessionData {
  return requireRole(ctx, ['admin']);
}

export { authError };
