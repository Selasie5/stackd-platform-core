import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  contestSubmissions,
  contests,
  cpmDeals,
  cpmSubmissions,
  ugcOrders,
  ugcSubmissions,
} from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { submissionError } from '@/submissions/errors';
import type { OpportunityType } from '@/opportunities/types';

const ACTIVE_SUBMISSION_STATUSES = [
  'submitted',
  'under_review',
  'shortlisted',
  'revision_requested',
  'resubmitted',
  'approved',
  'winner',
] as const;

export async function assertLiveUgcOrder(orderId: string) {
  const order = await db.query.ugcOrders.findFirst({
    where: and(eq(ugcOrders.id, orderId), isNull(ugcOrders.deletedAt)),
  });
  if (!order || order.status !== 'live') {
    throw submissionError('OPPORTUNITY_NOT_LIVE', 'UGC order is not live');
  }
  if (order.deadline < new Date()) {
    throw submissionError('DEADLINE_PASSED', 'Submission deadline has passed');
  }
  return order;
}

export async function assertLiveCpmDeal(dealId: string) {
  const deal = await db.query.cpmDeals.findFirst({
    where: and(eq(cpmDeals.id, dealId), isNull(cpmDeals.deletedAt)),
  });
  if (!deal || deal.status !== 'live') {
    throw submissionError('OPPORTUNITY_NOT_LIVE', 'CPM deal is not live');
  }
  if (deal.postingDeadline < new Date()) {
    throw submissionError('DEADLINE_PASSED', 'Posting deadline has passed');
  }
  return deal;
}

export async function assertLiveContest(contestId: string) {
  const contest = await db.query.contests.findFirst({
    where: and(eq(contests.id, contestId), isNull(contests.deletedAt)),
  });
  if (!contest || contest.status !== 'live') {
    throw submissionError('OPPORTUNITY_NOT_LIVE', 'Contest is not live');
  }
  if (contest.submissionDeadline < new Date()) {
    throw submissionError('DEADLINE_PASSED', 'Submission deadline has passed');
  }
  return contest;
}

export async function assertNoDuplicateUgcSubmission(orderId: string, creatorId: string) {
  const existing = await db.query.ugcSubmissions.findFirst({
    where: and(
      eq(ugcSubmissions.ugcOrderId, orderId),
      eq(ugcSubmissions.creatorId, creatorId),
      inArray(ugcSubmissions.status, [...ACTIVE_SUBMISSION_STATUSES]),
      isNull(ugcSubmissions.deletedAt),
    ),
  });
  if (existing) {
    throw submissionError(
      'DUPLICATE_SUBMISSION',
      'You already have an active submission for this order',
    );
  }
}

export async function assertNoDuplicateCpmSubmission(dealId: string, creatorId: string) {
  const existing = await db.query.cpmSubmissions.findFirst({
    where: and(
      eq(cpmSubmissions.cpmDealId, dealId),
      eq(cpmSubmissions.creatorId, creatorId),
      inArray(cpmSubmissions.status, [...ACTIVE_SUBMISSION_STATUSES]),
      isNull(cpmSubmissions.deletedAt),
    ),
  });
  if (existing) {
    throw submissionError(
      'DUPLICATE_SUBMISSION',
      'You already have an active submission for this deal',
    );
  }
}

export async function assertNoDuplicateContestSubmission(contestId: string, creatorId: string) {
  const existing = await db.query.contestSubmissions.findFirst({
    where: and(
      eq(contestSubmissions.contestId, contestId),
      eq(contestSubmissions.creatorId, creatorId),
      inArray(contestSubmissions.status, [...ACTIVE_SUBMISSION_STATUSES]),
      isNull(contestSubmissions.deletedAt),
    ),
  });
  if (existing) {
    throw submissionError(
      'DUPLICATE_SUBMISSION',
      'You already have an active submission for this contest',
    );
  }
}

export function assertBrandOwnsOpportunity(session: SessionData, brandId: string): void {
  if (session.role === 'admin') return;
  if (session.role !== 'brand' || session.brandId !== brandId) {
    throw submissionError('FORBIDDEN', 'You do not have access to this opportunity');
  }
}

export function assertCreatorSession(session: SessionData, creatorId: string): void {
  if (session.role !== 'creator' || session.creatorId !== creatorId) {
    throw submissionError('FORBIDDEN', 'You do not have access to this submission');
  }
}

export function opportunityTypeFromSubmission(type: 'ugc' | 'cpm' | 'contest'): OpportunityType {
  if (type === 'ugc') return 'UGC_ORDER';
  if (type === 'cpm') return 'CPM_DEAL';
  return 'CONTEST';
}
