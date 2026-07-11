import {
  submitKyc,
  reviewKyc,
  getMyKycApplication,
  listPendingKycApplications,
} from '@/kyc/kyc.service';
import { requireAuth, requireEmailVerified } from '@/auth/guards';
import { requireAdmin } from '@/kyc/guards';
import type { GraphQLContext } from '@/graphql-schema/context';

export const kycResolvers = {
  Query: {
    myKycApplication: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getMyKycApplication(session.userId);
    },
    pendingKycApplications: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAdmin(ctx);
      return listPendingKycApplications();
    },
  },
  Mutation: {
    submitKyc: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const session = requireEmailVerified(ctx);
      return submitKyc(session.userId, session.role, input);
    },
    reviewKyc: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const session = requireAdmin(ctx);
      return reviewKyc(session.userId, input);
    },
  },
};
