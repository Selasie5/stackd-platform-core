import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { brands, creators, ugcOrders, ugcSubmissions } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import type { SessionData } from '@/auth/types';
import { notify } from '@/notifications/notification.service';
import { allocateEscrow } from '@/payments/escrow.service';
import { submissionError } from '@/submissions/errors';
import {
  assertBrandOwnsOpportunity,
  assertLiveUgcOrder,
  assertNoDuplicateUgcSubmission,
} from '@/submissions/guards';

const submitSchema = z.object({
  ugcOrderId: z.string().uuid(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  watermarkedPreviewUrl: z.string().url().optional(),
  submissionNote: z.string().optional(),
  postedVideoLink: z.string().url().optional(),
});

const resubmitSchema = z.object({
  submissionId: z.string().uuid(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  watermarkedPreviewUrl: z.string().url().optional(),
  submissionNote: z.string().optional(),
  postedVideoLink: z.string().url().optional(),
});

type UgcSubmissionRow = InferSelectModel<typeof ugcSubmissions>;

export function formatUgcSubmission(row: UgcSubmissionRow) {
  return {
    id: row.id,
    ugcOrderId: row.ugcOrderId,
    creatorId: row.creatorId,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    watermarkedPreviewUrl: row.watermarkedPreviewUrl,
    cleanVideoUrl: row.cleanVideoUrl,
    submissionNote: row.submissionNote,
    revisionNumber: row.revisionNumber,
    revisionNote: row.revisionNote,
    postingRequired: row.postingRequired,
    postedVideoLink: row.postedVideoLink,
    status: row.status,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    cleanVideoReleasedAt: row.cleanVideoReleasedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getSubmission(id: string) {
  const row = await db.query.ugcSubmissions.findFirst({
    where: and(eq(ugcSubmissions.id, id), isNull(ugcSubmissions.deletedAt)),
  });
  if (!row) throw submissionError('SUBMISSION_NOT_FOUND', 'Submission not found');
  return row;
}

async function notifyBrandOfSubmission(orderId: string, submissionId: string) {
  const order = await db.query.ugcOrders.findFirst({ where: eq(ugcOrders.id, orderId) });
  if (!order) return;
  const brand = await db.query.brands.findFirst({ where: eq(brands.id, order.brandId) });
  if (!brand) return;
  await notify({
    userId: brand.userId,
    type: 'submission_received',
    title: 'New submission received',
    body: `A creator submitted content for "${order.title}".`,
    referenceType: 'ugc_submission',
    referenceId: submissionId,
  });
}

async function notifyCreator(
  creatorId: string,
  type: 'revision_requested' | 'video_approved',
  title: string,
  body: string,
  referenceId: string,
) {
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, creatorId) });
  if (!creator) return;
  await notify({
    userId: creator.userId,
    type,
    title,
    body,
    referenceType: 'ugc_submission',
    referenceId,
  });
}

export async function submitUgcSubmission(session: SessionData, input: unknown) {
  if (!session.creatorId) throw submissionError('FORBIDDEN', 'Creator profile required');
  const data = submitSchema.parse(input);
  const order = await assertLiveUgcOrder(data.ugcOrderId);
  await assertNoDuplicateUgcSubmission(data.ugcOrderId, session.creatorId);

  const [row] = await db
    .insert(ugcSubmissions)
    .values({
      ugcOrderId: data.ugcOrderId,
      creatorId: session.creatorId,
      videoUrl: data.videoUrl,
      thumbnailUrl: data.thumbnailUrl,
      watermarkedPreviewUrl: data.watermarkedPreviewUrl,
      submissionNote: data.submissionNote,
      postingRequired: order.postingRequired,
      postedVideoLink: data.postedVideoLink,
      status: 'submitted',
    })
    .returning();

  await notifyBrandOfSubmission(data.ugcOrderId, row.id);
  return formatUgcSubmission(row);
}

export async function requestUgcRevision(
  session: SessionData,
  submissionId: string,
  revisionNote: string,
) {
  const submission = await getSubmission(submissionId);
  const order = await db.query.ugcOrders.findFirst({
    where: eq(ugcOrders.id, submission.ugcOrderId),
  });
  if (!order) throw submissionError('SUBMISSION_NOT_FOUND', 'Order not found');
  assertBrandOwnsOpportunity(session, order.brandId);

  if (!['submitted', 'resubmitted', 'under_review'].includes(submission.status)) {
    throw submissionError('INVALID_STATUS', 'Cannot request revision for this submission');
  }
  if (submission.revisionNumber >= order.revisionLimit) {
    throw submissionError('REVISION_LIMIT_REACHED', 'Revision limit reached');
  }

  const [updated] = await db
    .update(ugcSubmissions)
    .set({
      status: 'revision_requested',
      revisionNote,
      revisionNumber: submission.revisionNumber + 1,
      updatedAt: new Date(),
    })
    .where(eq(ugcSubmissions.id, submissionId))
    .returning();

  await notifyCreator(
    submission.creatorId,
    'revision_requested',
    'Revision requested',
    revisionNote || 'Please revise your submission.',
    submissionId,
  );

  return formatUgcSubmission(updated);
}

export async function resubmitUgcSubmission(session: SessionData, input: unknown) {
  if (!session.creatorId) throw submissionError('FORBIDDEN', 'Creator profile required');
  const data = resubmitSchema.parse(input);
  const submission = await getSubmission(data.submissionId);
  if (submission.creatorId !== session.creatorId) {
    throw submissionError('FORBIDDEN', 'You do not own this submission');
  }
  if (submission.status !== 'revision_requested') {
    throw submissionError('INVALID_STATUS', 'Submission is not awaiting revision');
  }

  const [updated] = await db
    .update(ugcSubmissions)
    .set({
      videoUrl: data.videoUrl ?? submission.videoUrl,
      thumbnailUrl: data.thumbnailUrl ?? submission.thumbnailUrl,
      watermarkedPreviewUrl: data.watermarkedPreviewUrl ?? submission.watermarkedPreviewUrl,
      submissionNote: data.submissionNote ?? submission.submissionNote,
      postedVideoLink: data.postedVideoLink ?? submission.postedVideoLink,
      status: 'resubmitted',
      updatedAt: new Date(),
    })
    .where(eq(ugcSubmissions.id, data.submissionId))
    .returning();

  await notifyBrandOfSubmission(submission.ugcOrderId, updated.id);
  return formatUgcSubmission(updated);
}

export async function approveUgcSubmission(session: SessionData, submissionId: string) {
  const submission = await getSubmission(submissionId);
  const order = await db.query.ugcOrders.findFirst({
    where: eq(ugcOrders.id, submission.ugcOrderId),
  });
  if (!order) throw submissionError('SUBMISSION_NOT_FOUND', 'Order not found');
  assertBrandOwnsOpportunity(session, order.brandId);

  if (!['submitted', 'resubmitted', 'under_review'].includes(submission.status)) {
    throw submissionError('INVALID_STATUS', 'Cannot approve this submission');
  }

  const approvedCount = await db.query.ugcSubmissions.findMany({
    where: and(
      eq(ugcSubmissions.ugcOrderId, order.id),
      eq(ugcSubmissions.status, 'approved'),
      isNull(ugcSubmissions.deletedAt),
    ),
  });
  if (approvedCount.length >= order.numberOfCreators) {
    throw submissionError('SLOT_LIMIT_REACHED', 'All creator slots are filled');
  }

  const now = new Date();
  const [updated] = await db
    .update(ugcSubmissions)
    .set({
      status: 'approved',
      approvedAt: now,
      cleanVideoUrl: submission.cleanVideoUrl ?? submission.videoUrl,
      cleanVideoReleasedAt: now,
      updatedAt: now,
    })
    .where(eq(ugcSubmissions.id, submissionId))
    .returning();

  await allocateEscrow({
    opportunityType: 'UGC_ORDER',
    opportunityId: order.id,
    submissionType: 'ugc_submission',
    submissionId: updated.id,
    creatorId: submission.creatorId,
    amount: order.flatRatePerCreator,
    currency: order.currency,
  });

  await notifyCreator(
    submission.creatorId,
    'video_approved',
    'Submission approved',
    `Your submission for "${order.title}" was approved. Earnings release when the campaign completes.`,
    submissionId,
  );

  return formatUgcSubmission(updated);
}

export async function rejectUgcSubmission(session: SessionData, submissionId: string) {
  const submission = await getSubmission(submissionId);
  const order = await db.query.ugcOrders.findFirst({
    where: eq(ugcOrders.id, submission.ugcOrderId),
  });
  if (!order) throw submissionError('SUBMISSION_NOT_FOUND', 'Order not found');
  assertBrandOwnsOpportunity(session, order.brandId);

  const [updated] = await db
    .update(ugcSubmissions)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(ugcSubmissions.id, submissionId))
    .returning();

  return formatUgcSubmission(updated);
}

export async function listUgcSubmissionsForOrder(session: SessionData, orderId: string) {
  const order = await db.query.ugcOrders.findFirst({
    where: and(eq(ugcOrders.id, orderId), isNull(ugcOrders.deletedAt)),
  });
  if (!order) throw submissionError('SUBMISSION_NOT_FOUND', 'Order not found');
  assertBrandOwnsOpportunity(session, order.brandId);

  const rows = await db.query.ugcSubmissions.findMany({
    where: and(eq(ugcSubmissions.ugcOrderId, orderId), isNull(ugcSubmissions.deletedAt)),
  });
  return rows.map(formatUgcSubmission);
}

export async function listMyUgcSubmissions(creatorId: string) {
  const rows = await db.query.ugcSubmissions.findMany({
    where: and(eq(ugcSubmissions.creatorId, creatorId), isNull(ugcSubmissions.deletedAt)),
  });
  return rows.map(formatUgcSubmission);
}
