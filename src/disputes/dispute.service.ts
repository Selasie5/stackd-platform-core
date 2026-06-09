import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { disputes, payments } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import type { SessionData } from '@/auth/types';
import { notify, notifyAdmins } from '@/notifications/notification.service';
import { disputeError } from '@/disputes/errors';
import {
  assertCanOpenDispute,
  assertDisputeParticipant,
  getCounterpartyUserId,
  resolveDisputeReference,
  type DisputeReferenceType,
} from '@/disputes/guards';
import {
  applyDisputeSettlement,
  getBrandAndCreatorUserIds,
  notifyDisputeResolved,
} from '@/disputes/settlement.service';

type DisputeRow = InferSelectModel<typeof disputes>;

const openDisputeSchema = z.object({
  referenceType: z.enum(['ugc_submission', 'cpm_submission', 'contest_submission', 'payment']),
  referenceId: z.string().uuid(),
  subject: z.string().min(1).max(255),
  description: z.string().min(1),
});

const resolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  outcome: z.enum(['brand_upheld', 'creator_upheld', 'dismissed']),
  resolution: z.string().min(1),
});

export function formatDispute(row: DisputeRow) {
  return {
    id: row.id,
    raisedBy: row.raisedBy,
    raisedByUserId: row.raisedByUserId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    paymentId: row.paymentId,
    paymentStatusAtOpen: row.paymentStatusAtOpen,
    subject: row.subject,
    description: row.description,
    status: row.status,
    assignedTo: row.assignedTo,
    resolution: row.resolution,
    resolutionOutcome: row.resolutionOutcome,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function openDispute(session: SessionData, input: unknown) {
  const data = openDisputeSchema.parse(input);
  const ctx = await resolveDisputeReference(
    data.referenceType as DisputeReferenceType,
    data.referenceId,
  );
  const raisedBy = assertCanOpenDispute(session, ctx);

  if (!['in_escrow', 'ready_for_payout', 'paid'].includes(ctx.payment.status)) {
    throw disputeError('INVALID_STATUS', 'Cannot dispute this payment in its current state');
  }

  const existing = await db.query.disputes.findFirst({
    where: and(
      eq(disputes.referenceType, data.referenceType),
      eq(disputes.referenceId, data.referenceId),
      inArray(disputes.status, ['open', 'under_review']),
      isNull(disputes.deletedAt),
    ),
  });
  if (existing) {
    throw disputeError('DISPUTE_ALREADY_OPEN', 'An active dispute already exists for this reference');
  }

  const paymentStatusAtOpen = ctx.payment.status;

  const [row] = await db
    .insert(disputes)
    .values({
      raisedBy,
      raisedByUserId: session.userId,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      paymentId: ctx.payment.id,
      paymentStatusAtOpen,
      subject: data.subject,
      description: data.description,
      status: 'open',
    })
    .returning();

  await db
    .update(payments)
    .set({ status: 'disputed', updatedAt: new Date() })
    .where(eq(payments.id, ctx.payment.id));

  const counterpartyUserId = await getCounterpartyUserId(raisedBy, ctx);
  await notify({
    userId: counterpartyUserId,
    type: 'dispute_opened',
    title: 'Dispute opened',
    body: `A dispute was opened: ${data.subject}`,
    referenceType: 'dispute',
    referenceId: row.id,
  });

  await notifyAdmins({
    type: 'admin_dispute_opened',
    title: 'New dispute opened',
    body: `Dispute "${data.subject}" requires review.`,
    referenceType: 'dispute',
    referenceId: row.id,
  });

  return formatDispute(row);
}

export async function assignDispute(
  session: SessionData,
  disputeId: string,
  adminUserId?: string,
) {
  if (session.role !== 'admin') {
    throw disputeError('FORBIDDEN', 'Only admins can assign disputes');
  }

  const dispute = await getDisputeRow(disputeId);
  if (!['open', 'under_review'].includes(dispute.status)) {
    throw disputeError('INVALID_STATUS', 'Cannot assign this dispute');
  }

  const assignee = adminUserId ?? session.userId;
  const [updated] = await db
    .update(disputes)
    .set({
      assignedTo: assignee,
      status: 'under_review',
      updatedAt: new Date(),
    })
    .where(eq(disputes.id, disputeId))
    .returning();

  return formatDispute(updated);
}

export async function resolveDispute(session: SessionData, input: unknown) {
  if (session.role !== 'admin') {
    throw disputeError('FORBIDDEN', 'Only admins can resolve disputes');
  }

  const data = resolveDisputeSchema.parse(input);
  const dispute = await getDisputeRow(data.disputeId);
  if (!['open', 'under_review'].includes(dispute.status)) {
    throw disputeError('INVALID_STATUS', 'Dispute is not open for resolution');
  }

  const ctx = await resolveDisputeReference(
    dispute.referenceType as DisputeReferenceType,
    dispute.referenceId,
  );

  const paymentStatusAtOpen = dispute.paymentStatusAtOpen ?? ctx.payment.status;

  await applyDisputeSettlement(data.disputeId, data.outcome, ctx, paymentStatusAtOpen);

  const [updated] = await db
    .update(disputes)
    .set({
      status: 'resolved',
      resolution: data.resolution,
      resolutionOutcome: data.outcome,
      resolvedBy: session.userId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(disputes.id, data.disputeId))
    .returning();

  const { brandUserId, creatorUserId } = await getBrandAndCreatorUserIds(ctx);
  await notifyDisputeResolved(data.disputeId, ctx, brandUserId, creatorUserId);

  return formatDispute(updated);
}

export async function getDispute(session: SessionData, disputeId: string) {
  const dispute = await getDisputeRow(disputeId);
  const ctx = await resolveDisputeReference(
    dispute.referenceType as DisputeReferenceType,
    dispute.referenceId,
  );
  assertDisputeParticipant(session, ctx, dispute.assignedTo);
  return formatDispute(dispute);
}

export async function listMyDisputes(
  session: SessionData,
  status?: 'open' | 'under_review' | 'resolved' | 'closed',
) {
  if (session.role === 'brand' && session.brandId) {
    return listDisputesForBrand(session.brandId, status);
  }
  if (session.role === 'creator' && session.creatorId) {
    return listDisputesForCreator(session.creatorId, status);
  }
  throw disputeError('FORBIDDEN', 'Only brands and creators can list their disputes');
}

async function listDisputesForBrand(brandId: string, status?: string) {
  const all = await db.query.disputes.findMany({
    where: status
      ? and(eq(disputes.status, status as DisputeRow['status']), isNull(disputes.deletedAt))
      : isNull(disputes.deletedAt),
    orderBy: [desc(disputes.createdAt)],
    limit: 50,
  });

  const filtered: DisputeRow[] = [];
  for (const row of all) {
    try {
      const ctx = await resolveDisputeReference(
        row.referenceType as DisputeReferenceType,
        row.referenceId,
      );
      if (ctx.brandId === brandId) filtered.push(row);
    } catch {
      // skip invalid references
    }
  }
  return filtered.map(formatDispute);
}

async function listDisputesForCreator(creatorId: string, status?: string) {
  const all = await db.query.disputes.findMany({
    where: status
      ? and(eq(disputes.status, status as DisputeRow['status']), isNull(disputes.deletedAt))
      : isNull(disputes.deletedAt),
    orderBy: [desc(disputes.createdAt)],
    limit: 50,
  });

  const filtered: DisputeRow[] = [];
  for (const row of all) {
    try {
      const ctx = await resolveDisputeReference(
        row.referenceType as DisputeReferenceType,
        row.referenceId,
      );
      if (ctx.creatorId === creatorId) filtered.push(row);
    } catch {
      // skip
    }
  }
  return filtered.map(formatDispute);
}

export async function listAdminDisputes(
  status?: 'open' | 'under_review' | 'resolved' | 'closed',
  limit = 50,
) {
  const rows = await db.query.disputes.findMany({
    where: status
      ? and(eq(disputes.status, status), isNull(disputes.deletedAt))
      : isNull(disputes.deletedAt),
    orderBy: [desc(disputes.createdAt)],
    limit,
  });
  return rows.map(formatDispute);
}

async function getDisputeRow(disputeId: string): Promise<DisputeRow> {
  const row = await db.query.disputes.findFirst({
    where: and(eq(disputes.id, disputeId), isNull(disputes.deletedAt)),
  });
  if (!row) throw disputeError('DISPUTE_NOT_FOUND', 'Dispute not found');
  return row;
}

export async function getLinkedPayment(disputeId: string) {
  const dispute = await getDisputeRow(disputeId);
  if (!dispute.paymentId) return null;
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, dispute.paymentId),
  });
  if (!payment) return null;
  return {
    id: payment.id,
    creatorId: payment.creatorId,
    referenceType: payment.referenceType,
    referenceId: payment.referenceId,
    opportunityType: payment.opportunityType,
    opportunityId: payment.opportunityId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    processedAt: payment.processedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
