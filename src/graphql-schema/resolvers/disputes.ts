import type { GraphQLContext } from '@/graphql-schema/context';
import { requireAuth } from '@/auth/guards';
import { requireAdmin } from '@/kyc/guards';
import {
  assignDispute,
  getDispute,
  getLinkedPayment,
  listAdminDisputes,
  listMyDisputes,
  openDispute,
  resolveDispute,
} from '@/disputes/dispute.service';

export const disputesResolvers = {
  Dispute: {
    linkedPayment: async (parent: { id: string }) => getLinkedPayment(parent.id),
  },
  Query: {
    dispute: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getDispute(session, id);
    },
    myDisputes: async (
      _: unknown,
      { status }: { status?: 'open' | 'under_review' | 'resolved' | 'closed' },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return listMyDisputes(session, status);
    },
    adminDisputes: async (
      _: unknown,
      {
        status,
        limit,
      }: { status?: 'open' | 'under_review' | 'resolved' | 'closed'; limit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminDisputes(status, limit);
    },
  },
  Mutation: {
    openDispute: async (
      _: unknown,
      { input }: { input: Record<string, unknown> },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return openDispute(session, input);
    },
    assignDispute: async (
      _: unknown,
      { disputeId, adminUserId }: { disputeId: string; adminUserId?: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAdmin(ctx);
      return assignDispute(session, disputeId, adminUserId);
    },
    resolveDispute: async (
      _: unknown,
      { input }: { input: Record<string, unknown> },
      ctx: GraphQLContext,
    ) => {
      const session = requireAdmin(ctx);
      return resolveDispute(session, input);
    },
  },
};
