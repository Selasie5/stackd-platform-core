import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  brands,
  contestSubmissions,
  contests,
  cpmDeals,
  cpmSubmissions,
  creators,
  payments,
  ugcOrders,
  ugcSubmissions,
} from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { disputeError } from '@/disputes/errors';

export type DisputeReferenceType =
  | 'ugc_submission'
  | 'cpm_submission'
  | 'contest_submission'
  | 'payment';

const SUBMISSION_REFERENCE_TYPES: DisputeReferenceType[] = [
  'ugc_submission',
  'cpm_submission',
  'contest_submission',
];

export interface ResolvedDisputeContext {
  referenceType: DisputeReferenceType;
  referenceId: string;
  brandId: string;
  creatorId: string;
  opportunityId: string;
  opportunityType: 'ugc_order' | 'cpm_deal' | 'contest';
  payment: NonNullable<Awaited<ReturnType<typeof db.query.payments.findFirst>>>;
}

export async function resolveDisputeReference(
  referenceType: DisputeReferenceType,
  referenceId: string,
): Promise<ResolvedDisputeContext> {
  if (referenceType === 'payment') {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, referenceId),
    });
    if (!payment) throw disputeError('PAYMENT_NOT_FOUND', 'Payment not found');
    const oppType = payment.opportunityType as 'ugc_order' | 'cpm_deal' | 'contest';
    const brandId = await getBrandIdForOpportunity(oppType, payment.opportunityId);
    return {
      referenceType,
      referenceId,
      brandId,
      creatorId: payment.creatorId,
      opportunityId: payment.opportunityId,
      opportunityType: oppType,
      payment,
    };
  }

  if (referenceType === 'ugc_submission') {
    const submission = await db.query.ugcSubmissions.findFirst({
      where: and(eq(ugcSubmissions.id, referenceId), isNull(ugcSubmissions.deletedAt)),
    });
    if (!submission) throw disputeError('INVALID_REFERENCE', 'Submission not found');
    const order = await db.query.ugcOrders.findFirst({ where: eq(ugcOrders.id, submission.ugcOrderId) });
    if (!order) throw disputeError('INVALID_REFERENCE', 'Order not found');
    const payment = await findPaymentForSubmission('ugc_submission', submission.id);
    return {
      referenceType,
      referenceId,
      brandId: order.brandId,
      creatorId: submission.creatorId,
      opportunityId: order.id,
      opportunityType: 'ugc_order',
      payment,
    };
  }

  if (referenceType === 'cpm_submission') {
    const submission = await db.query.cpmSubmissions.findFirst({
      where: and(eq(cpmSubmissions.id, referenceId), isNull(cpmSubmissions.deletedAt)),
    });
    if (!submission) throw disputeError('INVALID_REFERENCE', 'Submission not found');
    const deal = await db.query.cpmDeals.findFirst({ where: eq(cpmDeals.id, submission.cpmDealId) });
    if (!deal) throw disputeError('INVALID_REFERENCE', 'Deal not found');
    const payment = await findPaymentForSubmission('cpm_submission', submission.id);
    return {
      referenceType,
      referenceId,
      brandId: deal.brandId,
      creatorId: submission.creatorId,
      opportunityId: deal.id,
      opportunityType: 'cpm_deal',
      payment,
    };
  }

  if (referenceType === 'contest_submission') {
    const submission = await db.query.contestSubmissions.findFirst({
      where: and(eq(contestSubmissions.id, referenceId), isNull(contestSubmissions.deletedAt)),
    });
    if (!submission) throw disputeError('INVALID_REFERENCE', 'Submission not found');
    const contest = await db.query.contests.findFirst({
      where: eq(contests.id, submission.contestId),
    });
    if (!contest) throw disputeError('INVALID_REFERENCE', 'Contest not found');
    const payment = await findPaymentForSubmission('contest_submission', submission.id);
    return {
      referenceType,
      referenceId,
      brandId: contest.brandId,
      creatorId: submission.creatorId,
      opportunityId: contest.id,
      opportunityType: 'contest',
      payment,
    };
  }

  throw disputeError('INVALID_REFERENCE', 'Invalid dispute reference type');
}

async function findPaymentForSubmission(referenceType: string, submissionId: string) {
  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.referenceType, referenceType), eq(payments.referenceId, submissionId)),
  });
  if (!payment) throw disputeError('PAYMENT_NOT_FOUND', 'No payment found for this submission');
  return payment;
}

async function getBrandIdForOpportunity(
  opportunityType: 'ugc_order' | 'cpm_deal' | 'contest',
  opportunityId: string,
): Promise<string> {
  if (opportunityType === 'ugc_order') {
    const row = await db.query.ugcOrders.findFirst({ where: eq(ugcOrders.id, opportunityId) });
    if (!row) throw disputeError('INVALID_REFERENCE', 'Opportunity not found');
    return row.brandId;
  }
  if (opportunityType === 'cpm_deal') {
    const row = await db.query.cpmDeals.findFirst({ where: eq(cpmDeals.id, opportunityId) });
    if (!row) throw disputeError('INVALID_REFERENCE', 'Opportunity not found');
    return row.brandId;
  }
  const row = await db.query.contests.findFirst({ where: eq(contests.id, opportunityId) });
  if (!row) throw disputeError('INVALID_REFERENCE', 'Opportunity not found');
  return row.brandId;
}

export function assertCanOpenDispute(
  session: SessionData,
  ctx: ResolvedDisputeContext,
): 'brand' | 'creator' {
  if (session.role === 'admin') {
    throw disputeError('FORBIDDEN', 'Admins cannot open disputes');
  }
  if (session.role === 'brand' && session.brandId === ctx.brandId) {
    return 'brand';
  }
  if (session.role === 'creator' && session.creatorId === ctx.creatorId) {
    return 'creator';
  }
  throw disputeError('FORBIDDEN', 'You cannot open a dispute on this reference');
}

export function assertDisputeParticipant(
  session: SessionData,
  ctx: ResolvedDisputeContext,
  assignedTo?: string | null,
): void {
  if (session.role === 'admin') return;
  if (session.role === 'brand' && session.brandId === ctx.brandId) return;
  if (session.role === 'creator' && session.creatorId === ctx.creatorId) return;
  if (assignedTo && session.userId === assignedTo) return;
  throw disputeError('FORBIDDEN', 'You do not have access to this dispute');
}

export async function getCounterpartyUserId(
  raisedBy: 'brand' | 'creator',
  ctx: ResolvedDisputeContext,
): Promise<string> {
  if (raisedBy === 'brand') {
    const creator = await db.query.creators.findFirst({
      where: eq(creators.id, ctx.creatorId),
      columns: { userId: true },
    });
    if (!creator) throw disputeError('INVALID_REFERENCE', 'Creator not found');
    return creator.userId;
  }
  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, ctx.brandId),
    columns: { userId: true },
  });
  if (!brand) throw disputeError('INVALID_REFERENCE', 'Brand not found');
  return brand.userId;
}

export function isSubmissionReferenceType(type: string): type is DisputeReferenceType {
  return SUBMISSION_REFERENCE_TYPES.includes(type as DisputeReferenceType);
}

export async function getDisputedPaymentIdsForOpportunity(opportunityId: string): Promise<string[]> {
  const { disputes } = await import('@/db/schema/index');
  const rows = await db.query.disputes.findMany({
    where: and(
      inArray(disputes.status, ['open', 'under_review']),
      isNull(disputes.deletedAt),
    ),
    columns: { paymentId: true, referenceType: true, referenceId: true },
  });

  const paymentIds: string[] = [];
  for (const row of rows) {
    if (row.paymentId) {
      const payment = await db.query.payments.findFirst({
        where: eq(payments.id, row.paymentId),
        columns: { opportunityId: true },
      });
      if (payment?.opportunityId === opportunityId) {
        paymentIds.push(row.paymentId);
      }
    }
  }
  return paymentIds;
}
