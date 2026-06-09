import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  contestSubmissions,
  contests,
  cpmDeals,
  cpmSubmissions,
  disputes,
  ugcOrders,
  ugcSubmissions,
  users,
} from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { messageError } from '@/messaging/errors';

export type MessageReferenceType = 'ugc_order' | 'cpm_deal' | 'contest' | 'dispute';

export async function assertCanAccessThread(
  session: SessionData,
  referenceType: MessageReferenceType,
  referenceId: string,
): Promise<void> {
  if (session.role === 'admin') return;

  if (referenceType === 'dispute') {
    const dispute = await db.query.disputes.findFirst({
      where: and(eq(disputes.id, referenceId), isNull(disputes.deletedAt)),
    });
    if (!dispute) throw messageError('INVALID_REFERENCE', 'Dispute not found');

    const { resolveDisputeReference } = await import('@/disputes/guards');
    const ctx = await resolveDisputeReference(
      dispute.referenceType as 'ugc_submission' | 'cpm_submission' | 'contest_submission' | 'payment',
      dispute.referenceId,
    );

    if (session.role === 'brand' && session.brandId === ctx.brandId) return;
    if (session.role === 'creator' && session.creatorId === ctx.creatorId) return;
    if (dispute.assignedTo && dispute.assignedTo === session.userId) return;
    throw messageError('FORBIDDEN', 'You cannot access this dispute thread');
  }

  if (referenceType === 'ugc_order') {
    const order = await db.query.ugcOrders.findFirst({
      where: and(eq(ugcOrders.id, referenceId), isNull(ugcOrders.deletedAt)),
    });
    if (!order) throw messageError('INVALID_REFERENCE', 'Order not found');
    if (session.role === 'brand' && session.brandId === order.brandId) return;
    if (session.role === 'creator' && session.creatorId) {
      const submission = await db.query.ugcSubmissions.findFirst({
        where: and(
          eq(ugcSubmissions.ugcOrderId, order.id),
          eq(ugcSubmissions.creatorId, session.creatorId),
          inArray(ugcSubmissions.status, [
            'submitted',
            'under_review',
            'revision_requested',
            'resubmitted',
            'approved',
          ]),
          isNull(ugcSubmissions.deletedAt),
        ),
      });
      if (submission) return;
    }
    throw messageError('FORBIDDEN', 'You cannot access this conversation');
  }

  if (referenceType === 'cpm_deal') {
    const deal = await db.query.cpmDeals.findFirst({
      where: and(eq(cpmDeals.id, referenceId), isNull(cpmDeals.deletedAt)),
    });
    if (!deal) throw messageError('INVALID_REFERENCE', 'Deal not found');
    if (session.role === 'brand' && session.brandId === deal.brandId) return;
    if (session.role === 'creator' && session.creatorId) {
      const submission = await db.query.cpmSubmissions.findFirst({
        where: and(
          eq(cpmSubmissions.cpmDealId, deal.id),
          eq(cpmSubmissions.creatorId, session.creatorId),
          isNull(cpmSubmissions.deletedAt),
        ),
      });
      if (submission) return;
    }
    throw messageError('FORBIDDEN', 'You cannot access this conversation');
  }

  if (referenceType === 'contest') {
    const contest = await db.query.contests.findFirst({
      where: and(eq(contests.id, referenceId), isNull(contests.deletedAt)),
    });
    if (!contest) throw messageError('INVALID_REFERENCE', 'Contest not found');
    if (session.role === 'brand' && session.brandId === contest.brandId) return;
    if (session.role === 'creator' && session.creatorId) {
      const submission = await db.query.contestSubmissions.findFirst({
        where: and(
          eq(contestSubmissions.contestId, contest.id),
          eq(contestSubmissions.creatorId, session.creatorId),
          isNull(contestSubmissions.deletedAt),
        ),
      });
      if (submission) return;
    }
    throw messageError('FORBIDDEN', 'You cannot access this conversation');
  }
}

export async function assertValidRecipient(recipientId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, recipientId), isNull(users.deletedAt)),
  });
  if (!user) throw messageError('RECIPIENT_NOT_FOUND', 'Recipient not found');
}
