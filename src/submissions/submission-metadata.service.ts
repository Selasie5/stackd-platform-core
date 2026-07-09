import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { cpmDeals, contests, payments, ugcOrders } from '@/db/schema/index';

export async function getUgcSubmissionMeta(ugcOrderId: string) {
  const order = await db.query.ugcOrders.findFirst({
    where: eq(ugcOrders.id, ugcOrderId),
    with: { brand: true },
  });

  if (!order) return null;

  return {
    opportunityTitle: order.title,
    brandName: order.brand?.brandName ?? null,
    potentialPayout: order.flatRatePerCreator,
    currency: order.currency,
  };
}

export async function getCpmSubmissionMeta(cpmDealId: string) {
  const deal = await db.query.cpmDeals.findFirst({
    where: eq(cpmDeals.id, cpmDealId),
    with: { brand: true },
  });

  if (!deal) return null;

  return {
    opportunityTitle: deal.title,
    brandName: deal.brand?.brandName ?? null,
    potentialPayout: deal.payPer1000Views,
    currency: deal.currency,
  };
}

export async function getContestSubmissionMeta(contestId: string) {
  const contest = await db.query.contests.findFirst({
    where: eq(contests.id, contestId),
    with: { brand: true },
  });

  if (!contest) return null;

  return {
    opportunityTitle: contest.title,
    brandName: contest.brand?.brandName ?? null,
    potentialPayout: contest.totalContestBudget,
    currency: contest.currency,
  };
}

export async function getSubmissionPayment(submissionId: string) {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.referenceId, submissionId),
  });

  if (!payment) return null;

  return {
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    paymentStatus: payment.status,
    paymentDate: payment.processedAt?.toISOString() ?? payment.updatedAt.toISOString(),
  };
}
