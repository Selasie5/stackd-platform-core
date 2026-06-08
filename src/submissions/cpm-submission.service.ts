import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { brands, creators, cpmDeals, cpmSubmissions } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import type { SessionData } from '@/auth/types';
import { notify } from '@/notifications/notification.service';
import { allocateEscrow } from '@/payments/escrow.service';
import { formatAmount, parseAmount } from '@/opportunities/wallet.service';
import { submissionError } from '@/submissions/errors';
import {
  assertBrandOwnsOpportunity,
  assertLiveCpmDeal,
  assertNoDuplicateCpmSubmission,
} from '@/submissions/guards';

const submitSchema = z.object({
  cpmDealId: z.string().uuid(),
  postedVideoLink: z.string().url(),
  platform: z.enum(['tiktok', 'instagram', 'youtube_shorts', 'any']),
  submissionNote: z.string().optional(),
  analyticsScreenshotUrl: z.string().url().optional(),
  submittedViews: z.number().int().min(0).optional(),
  engagementCount: z.number().int().min(0).optional(),
});

type CpmSubmissionRow = InferSelectModel<typeof cpmSubmissions>;

export function formatCpmSubmission(row: CpmSubmissionRow) {
  return {
    id: row.id,
    cpmDealId: row.cpmDealId,
    creatorId: row.creatorId,
    postedVideoLink: row.postedVideoLink,
    platform: row.platform,
    submissionNote: row.submissionNote,
    analyticsScreenshotUrl: row.analyticsScreenshotUrl,
    submittedViews: row.submittedViews,
    approvedViews: row.approvedViews,
    engagementCount: row.engagementCount,
    calculatedPayout: row.calculatedPayout,
    viewVerificationStatus: row.viewVerificationStatus,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getSubmission(id: string) {
  const row = await db.query.cpmSubmissions.findFirst({
    where: and(eq(cpmSubmissions.id, id), isNull(cpmSubmissions.deletedAt)),
  });
  if (!row) throw submissionError('SUBMISSION_NOT_FOUND', 'Submission not found');
  return row;
}

function computePayout(approvedViews: number, payPer1000: string, maxViews: number): string {
  const capped = Math.min(approvedViews, maxViews);
  const payout = (capped / 1000) * parseAmount(payPer1000);
  return formatAmount(payout);
}

export async function submitCpmSubmission(session: SessionData, input: unknown) {
  if (!session.creatorId) throw submissionError('FORBIDDEN', 'Creator profile required');
  const data = submitSchema.parse(input);
  await assertLiveCpmDeal(data.cpmDealId);
  await assertNoDuplicateCpmSubmission(data.cpmDealId, session.creatorId);

  const [row] = await db
    .insert(cpmSubmissions)
    .values({
      cpmDealId: data.cpmDealId,
      creatorId: session.creatorId,
      postedVideoLink: data.postedVideoLink,
      platform: data.platform,
      submissionNote: data.submissionNote,
      analyticsScreenshotUrl: data.analyticsScreenshotUrl,
      submittedViews: data.submittedViews ?? 0,
      engagementCount: data.engagementCount ?? 0,
      status: 'submitted',
    })
    .returning();

  const deal = await db.query.cpmDeals.findFirst({ where: eq(cpmDeals.id, data.cpmDealId) });
  if (deal) {
    const brand = await db.query.brands.findFirst({ where: eq(brands.id, deal.brandId) });
    if (brand) {
      await notify({
        userId: brand.userId,
        type: 'submission_received',
        title: 'New CPM submission',
        body: `A creator submitted content for "${deal.title}".`,
        referenceType: 'cpm_submission',
        referenceId: row.id,
      });
    }
  }

  return formatCpmSubmission(row);
}

export async function verifyCpmViews(
  session: SessionData,
  submissionId: string,
  approvedViews: number,
) {
  const submission = await getSubmission(submissionId);
  const deal = await db.query.cpmDeals.findFirst({ where: eq(cpmDeals.id, submission.cpmDealId) });
  if (!deal) throw submissionError('SUBMISSION_NOT_FOUND', 'Deal not found');
  assertBrandOwnsOpportunity(session, deal.brandId);

  const calculatedPayout = computePayout(
    approvedViews,
    deal.payPer1000Views,
    deal.maxPayableViewsPerCreator,
  );

  const [updated] = await db
    .update(cpmSubmissions)
    .set({
      approvedViews,
      calculatedPayout,
      viewVerificationStatus: 'verified',
      viewsVerifiedAt: new Date(),
      viewsVerifiedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(cpmSubmissions.id, submissionId))
    .returning();

  return formatCpmSubmission(updated);
}

export async function approveCpmSubmission(session: SessionData, submissionId: string) {
  const submission = await getSubmission(submissionId);
  const deal = await db.query.cpmDeals.findFirst({ where: eq(cpmDeals.id, submission.cpmDealId) });
  if (!deal) throw submissionError('SUBMISSION_NOT_FOUND', 'Deal not found');
  assertBrandOwnsOpportunity(session, deal.brandId);

  if (submission.approvedViews == null || submission.calculatedPayout == null) {
    throw submissionError('INVALID_STATUS', 'Views must be verified before approval');
  }

  const [updated] = await db
    .update(cpmSubmissions)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(cpmSubmissions.id, submissionId))
    .returning();

  await allocateEscrow({
    opportunityType: 'CPM_DEAL',
    opportunityId: deal.id,
    submissionType: 'cpm_submission',
    submissionId: updated.id,
    creatorId: submission.creatorId,
    amount: submission.calculatedPayout,
    currency: deal.currency,
  });

  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, submission.creatorId),
  });
  if (creator) {
    await notify({
      userId: creator.userId,
      type: 'video_approved',
      title: 'CPM submission approved',
      body: `Your submission for "${deal.title}" was approved. Earnings release when the campaign completes.`,
      referenceType: 'cpm_submission',
      referenceId: submissionId,
    });
  }

  return formatCpmSubmission(updated);
}

export async function listCpmSubmissionsForDeal(session: SessionData, dealId: string) {
  const deal = await db.query.cpmDeals.findFirst({
    where: and(eq(cpmDeals.id, dealId), isNull(cpmDeals.deletedAt)),
  });
  if (!deal) throw submissionError('SUBMISSION_NOT_FOUND', 'Deal not found');
  assertBrandOwnsOpportunity(session, deal.brandId);

  const rows = await db.query.cpmSubmissions.findMany({
    where: and(eq(cpmSubmissions.cpmDealId, dealId), isNull(cpmSubmissions.deletedAt)),
  });
  return rows.map(formatCpmSubmission);
}

export async function listMyCpmSubmissions(creatorId: string) {
  const rows = await db.query.cpmSubmissions.findMany({
    where: and(eq(cpmSubmissions.creatorId, creatorId), isNull(cpmSubmissions.deletedAt)),
  });
  return rows.map(formatCpmSubmission);
}
