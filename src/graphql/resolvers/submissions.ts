import type { GraphQLContext } from '@/graphql/context';
import { requireAuth } from '@/auth/guards';
import { requireBrandWriteAccess, requireCreatorApplyAccess } from '@/kyc/guards';
import {
  approveCpmSubmission,
  approveUgcSubmission,
  listCpmSubmissionsForDeal,
  listContestSubmissionsForContest,
  listLiveContests,
  listLiveCpmDeals,
  listLiveUgcOrders,
  listMyContestSubmissions,
  listMyCpmSubmissions,
  listMyUgcSubmissions,
  listUgcSubmissionsForOrder,
  rejectUgcSubmission,
  requestUgcRevision,
  resubmitUgcSubmission,
  selectContestWinners,
  shortlistContestSubmission,
  submitContestSubmission,
  submitCpmSubmission,
  submitUgcSubmission,
  verifyCpmViews,
} from '@/submissions/index';

export const submissionsResolvers = {
  Query: {
    liveUgcOrders: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      await requireCreatorApplyAccess(ctx);
      return listLiveUgcOrders();
    },
    liveCpmDeals: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      await requireCreatorApplyAccess(ctx);
      return listLiveCpmDeals();
    },
    liveContests: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      await requireCreatorApplyAccess(ctx);
      return listLiveContests();
    },
    myUgcSubmissions: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return listMyUgcSubmissions(session.creatorId!);
    },
    myCpmSubmissions: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return listMyCpmSubmissions(session.creatorId!);
    },
    myContestSubmissions: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return listMyContestSubmissions(session.creatorId!);
    },
    ugcSubmissions: async (_: unknown, { orderId }: { orderId: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return listUgcSubmissionsForOrder(session, orderId);
    },
    cpmSubmissions: async (_: unknown, { dealId }: { dealId: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return listCpmSubmissionsForDeal(session, dealId);
    },
    contestSubmissions: async (
      _: unknown,
      { contestId }: { contestId: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return listContestSubmissionsForContest(session, contestId);
    },
  },
  Mutation: {
    submitUgcSubmission: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return submitUgcSubmission(session, input);
    },
    requestUgcRevision: async (
      _: unknown,
      { submissionId, revisionNote }: { submissionId: string; revisionNote: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return requestUgcRevision(session, submissionId, revisionNote);
    },
    resubmitUgcSubmission: async (
      _: unknown,
      { input }: { input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = await requireCreatorApplyAccess(ctx);
      return resubmitUgcSubmission(session, input);
    },
    approveUgcSubmission: async (
      _: unknown,
      { submissionId }: { submissionId: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return approveUgcSubmission(session, submissionId);
    },
    rejectUgcSubmission: async (
      _: unknown,
      { submissionId }: { submissionId: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return rejectUgcSubmission(session, submissionId);
    },
    submitCpmSubmission: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return submitCpmSubmission(session, input);
    },
    verifyCpmViews: async (
      _: unknown,
      { submissionId, approvedViews }: { submissionId: string; approvedViews: number },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return verifyCpmViews(session, submissionId, approvedViews);
    },
    approveCpmSubmission: async (
      _: unknown,
      { submissionId }: { submissionId: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return approveCpmSubmission(session, submissionId);
    },
    submitContestSubmission: async (
      _: unknown,
      { input }: { input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = await requireCreatorApplyAccess(ctx);
      return submitContestSubmission(session, input);
    },
    shortlistContestSubmission: async (
      _: unknown,
      { submissionId }: { submissionId: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return shortlistContestSubmission(session, submissionId);
    },
    selectContestWinners: async (
      _: unknown,
      { input }: { input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return selectContestWinners(session, input);
    },
  },
};
