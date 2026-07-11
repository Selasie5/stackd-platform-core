import type { GraphQLContext } from '@/graphql-schema/context';
import { requireAuth } from '@/auth/guards';
import { requireBrandWriteAccess, requireCreatorApplyAccess, requireCreatorBrowseAccess } from '@/kyc/guards';
import { getCreatorById } from '@/auth/creator.service';
import {
  approveCpmSubmission,
  approveUgcSubmission,
  getContestForCreatorBrowse,
  getContestPublicLeaderboard,
  getContestSubmissionCount,
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
import {
  getContestSubmissionMeta,
  getCpmSubmissionMeta,
  getSubmissionPayment,
  getUgcSubmissionMeta,
} from '@/submissions/submission-metadata.service';

const submissionMetaResolvers = {
  creator: async (parent: { creatorId: string }) => {
    if (!parent.creatorId) return null;
    return getCreatorById(parent.creatorId);
  },
  opportunityTitle: async (
    parent: { ugcOrderId?: string; cpmDealId?: string; contestId?: string },
  ) => {
    if (parent.ugcOrderId) return (await getUgcSubmissionMeta(parent.ugcOrderId))?.opportunityTitle ?? null;
    if (parent.cpmDealId) return (await getCpmSubmissionMeta(parent.cpmDealId))?.opportunityTitle ?? null;
    if (parent.contestId) return (await getContestSubmissionMeta(parent.contestId))?.opportunityTitle ?? null;
    return null;
  },
  brandName: async (
    parent: { ugcOrderId?: string; cpmDealId?: string; contestId?: string },
  ) => {
    if (parent.ugcOrderId) return (await getUgcSubmissionMeta(parent.ugcOrderId))?.brandName ?? null;
    if (parent.cpmDealId) return (await getCpmSubmissionMeta(parent.cpmDealId))?.brandName ?? null;
    if (parent.contestId) return (await getContestSubmissionMeta(parent.contestId))?.brandName ?? null;
    return null;
  },
  potentialPayout: async (
    parent: {
      ugcOrderId?: string;
      cpmDealId?: string;
      contestId?: string;
      calculatedPayout?: string | null;
      rewardAmount?: string | null;
    },
  ) => {
    if (parent.rewardAmount) return parent.rewardAmount;
    if (parent.calculatedPayout) return parent.calculatedPayout;
    if (parent.ugcOrderId) return (await getUgcSubmissionMeta(parent.ugcOrderId))?.potentialPayout ?? null;
    if (parent.cpmDealId) return (await getCpmSubmissionMeta(parent.cpmDealId))?.potentialPayout ?? null;
    if (parent.contestId) return (await getContestSubmissionMeta(parent.contestId))?.potentialPayout ?? null;
    return null;
  },
  currency: async (
    parent: { ugcOrderId?: string; cpmDealId?: string; contestId?: string },
  ) => {
    if (parent.ugcOrderId) return (await getUgcSubmissionMeta(parent.ugcOrderId))?.currency ?? null;
    if (parent.cpmDealId) return (await getCpmSubmissionMeta(parent.cpmDealId))?.currency ?? null;
    if (parent.contestId) return (await getContestSubmissionMeta(parent.contestId))?.currency ?? null;
    return null;
  },
  paymentAmount: async (parent: { id: string }) =>
    (await getSubmissionPayment(parent.id))?.paymentAmount ?? null,
  paymentDate: async (parent: { id: string }) =>
    (await getSubmissionPayment(parent.id))?.paymentDate ?? null,
  paymentStatus: async (parent: { id: string }) =>
    (await getSubmissionPayment(parent.id))?.paymentStatus ?? null,
};

export const submissionsResolvers = {
  UgcSubmission: submissionMetaResolvers,
  CpmSubmission: submissionMetaResolvers,
  ContestSubmission: submissionMetaResolvers,
  Query: {
    liveUgcOrders: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      await requireCreatorBrowseAccess(ctx);
      return listLiveUgcOrders();
    },
    liveCpmDeals: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      await requireCreatorBrowseAccess(ctx);
      return listLiveCpmDeals();
    },
    liveContests: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      await requireCreatorBrowseAccess(ctx);
      return listLiveContests();
    },
    liveContest: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      await requireCreatorBrowseAccess(ctx);
      return getContestForCreatorBrowse(id);
    },
    contestSubmissionCount: async (
      _: unknown,
      { contestId }: { contestId: string },
      ctx: GraphQLContext,
    ) => {
      await requireCreatorBrowseAccess(ctx);
      return getContestSubmissionCount(contestId);
    },
    contestPublicLeaderboard: async (
      _: unknown,
      { contestId, limit }: { contestId: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      await requireCreatorBrowseAccess(ctx);
      return getContestPublicLeaderboard(contestId, limit ?? 20);
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
