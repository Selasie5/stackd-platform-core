import {
  cancelOpportunity,
  closeOpportunity,
  completeOpportunity,
  createContest,
  createCpmDeal,
  createUgcOrder,
  deleteContest,
  deleteCpmDeal,
  deleteUgcOrder,
  getContestForSession,
  getCpmDealForSession,
  getUgcOrderForSession,
  listMyContests,
  listMyCpmDeals,
  listMyUgcOrders,
  listPendingOpportunities,
  pauseOpportunity,
  resumeOpportunity,
  reviewOpportunity,
  submitOpportunityForApproval,
  updateContest,
  updateCpmDeal,
  updateUgcOrder,
} from '@/opportunities/index';
import { requireAuth } from '@/auth/guards';
import { requireAdmin, requireBrandWriteAccess } from '@/kyc/guards';
import type { GraphQLContext } from '@/graphql/context';
import type { OpportunityType, OpportunityStatus } from '@/opportunities/types';

export const opportunitiesResolvers = {
  OpportunityResult: {
    __resolveType(obj: { __typename?: string }) {
      if (obj.__typename === 'UgcOrder') return 'UgcOrder';
      if (obj.__typename === 'CpmDeal') return 'CpmDeal';
      if (obj.__typename === 'Contest') return 'Contest';
      return null;
    },
  },
  Query: {
    myUgcOrders: async (
      _: unknown,
      { status }: { status?: OpportunityStatus },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return listMyUgcOrders(session.brandId!, status);
    },
    myCpmDeals: async (
      _: unknown,
      { status }: { status?: OpportunityStatus },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return listMyCpmDeals(session.brandId!, status);
    },
    myContests: async (
      _: unknown,
      { status }: { status?: OpportunityStatus },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return listMyContests(session.brandId!, status);
    },
    ugcOrder: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getUgcOrderForSession(session.brandId, session.role === 'admin', id);
    },
    cpmDeal: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getCpmDealForSession(session.brandId, session.role === 'admin', id);
    },
    contest: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getContestForSession(session.brandId, session.role === 'admin', id);
    },
    pendingOpportunities: async (
      _: unknown,
      { type }: { type?: OpportunityType },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listPendingOpportunities(type);
    },
  },
  Mutation: {
    createUgcOrder: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return createUgcOrder(session.brandId!, input);
    },
    updateUgcOrder: async (
      _: unknown,
      { id, input }: { id: string; input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return updateUgcOrder(session.brandId!, id, input);
    },
    deleteUgcOrder: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return deleteUgcOrder(session.brandId!, id);
    },
    createCpmDeal: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return createCpmDeal(session.brandId!, input);
    },
    updateCpmDeal: async (
      _: unknown,
      { id, input }: { id: string; input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return updateCpmDeal(session.brandId!, id, input);
    },
    deleteCpmDeal: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return deleteCpmDeal(session.brandId!, id);
    },
    createContest: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return createContest(session.brandId!, input);
    },
    updateContest: async (
      _: unknown,
      { id, input }: { id: string; input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return updateContest(session.brandId!, id, input);
    },
    deleteContest: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return deleteContest(session.brandId!, id);
    },
    submitOpportunityForApproval: async (
      _: unknown,
      { type, id }: { type: OpportunityType; id: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return submitOpportunityForApproval(session, type, id);
    },
    reviewOpportunity: async (
      _: unknown,
      { input }: { input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = requireAdmin(ctx);
      return reviewOpportunity(session, input as {
        type: OpportunityType;
        id: string;
        decision: 'approved' | 'rejected';
        adminNote?: string;
      });
    },
    pauseOpportunity: async (
      _: unknown,
      { type, id }: { type: OpportunityType; id: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return pauseOpportunity(session, type, id);
    },
    resumeOpportunity: async (
      _: unknown,
      { type, id }: { type: OpportunityType; id: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return resumeOpportunity(session, type, id);
    },
    closeOpportunity: async (
      _: unknown,
      { type, id }: { type: OpportunityType; id: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return closeOpportunity(session, type, id);
    },
    cancelOpportunity: async (
      _: unknown,
      { type, id }: { type: OpportunityType; id: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return cancelOpportunity(session, type, id);
    },
    completeOpportunity: async (
      _: unknown,
      { type, id }: { type: OpportunityType; id: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return completeOpportunity(session, type, id);
    },
  },
};
