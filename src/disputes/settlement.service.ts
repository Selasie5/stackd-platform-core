import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { brands, creators, payments } from '@/db/schema/index';
import { disputeError } from '@/disputes/errors';
import type { ResolvedDisputeContext } from '@/disputes/guards';
import { notify } from '@/notifications/notification.service';
import { loadOpportunity } from '@/opportunities/opportunity.loader';
import type { OpportunityType } from '@/opportunities/types';
import { releaseSingleEscrowPayment } from '@/payments/escrow.service';
import { creditFunds, releaseFunds } from '@/opportunities/wallet.service';
import { debitCreatorBalanceAdjustment } from '@/wallets/creator-wallet.service';

type DisputeOutcome = 'brand_upheld' | 'creator_upheld' | 'dismissed';

export async function applyDisputeSettlement(
  disputeId: string,
  outcome: DisputeOutcome,
  ctx: ResolvedDisputeContext,
  paymentStatusAtOpen: string,
): Promise<void> {
  const payment = ctx.payment;

  if (outcome === 'dismissed') {
    const restoreStatus = paymentStatusAtOpen as
      | 'in_escrow'
      | 'ready_for_payout'
      | 'paid'
      | 'awaiting_approval';
    if (!['in_escrow', 'ready_for_payout', 'paid', 'awaiting_approval'].includes(restoreStatus)) {
      throw disputeError('CANNOT_RESOLVE', 'Cannot restore payment status');
    }
    await db
      .update(payments)
      .set({ status: restoreStatus, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    return;
  }

  if (outcome === 'brand_upheld') {
    if (payment.status === 'paid') {
      throw disputeError(
        'CANNOT_RESOLVE',
        'Cannot automatically refund a payment that has already been withdrawn. Handle manually.',
      );
    }

    await db
      .update(payments)
      .set({ status: 'refunded', updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    const reference = {
      referenceType: 'dispute' as const,
      referenceId: disputeId,
      description: `Dispute refund for payment ${payment.id}`,
    };

    if (paymentStatusAtOpen === 'in_escrow' || payment.status === 'disputed') {
      await releaseFunds(ctx.brandId, payment.amount, payment.currency, reference);
    } else if (paymentStatusAtOpen === 'ready_for_payout') {
      await debitCreatorBalanceAdjustment(
        ctx.creatorId,
        payment.amount,
        payment.currency,
        reference,
      );
      await creditFunds(ctx.brandId, payment.amount, payment.currency, reference);
    }
    return;
  }

  // creator_upheld
  if (paymentStatusAtOpen === 'in_escrow') {
    await db
      .update(payments)
      .set({ status: 'in_escrow', updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    const opportunityType: OpportunityType =
      ctx.opportunityType === 'ugc_order'
        ? 'UGC_ORDER'
        : ctx.opportunityType === 'cpm_deal'
          ? 'CPM_DEAL'
          : 'CONTEST';
    const opportunity = await loadOpportunity(opportunityType, ctx.opportunityId);
    const isComplete = opportunity.status === 'completed';

    if (isComplete) {
      await releaseSingleEscrowPayment(payment.id);
    }
    return;
  }

  if (paymentStatusAtOpen === 'ready_for_payout') {
    await db
      .update(payments)
      .set({ status: 'ready_for_payout', updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    return;
  }

  if (paymentStatusAtOpen === 'paid') {
    await db
      .update(payments)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }
}

export async function notifyDisputeResolved(
  disputeId: string,
  ctx: ResolvedDisputeContext,
  brandUserId: string,
  creatorUserId: string,
): Promise<void> {
  const title = 'Dispute resolved';
  const body = 'A dispute on your campaign submission has been resolved.';
  await Promise.all([
    notify({
      userId: brandUserId,
      type: 'dispute_resolved',
      title,
      body,
      referenceType: 'dispute',
      referenceId: disputeId,
    }),
    notify({
      userId: creatorUserId,
      type: 'dispute_resolved',
      title,
      body,
      referenceType: 'dispute',
      referenceId: disputeId,
    }),
  ]);
}

export async function getBrandAndCreatorUserIds(ctx: ResolvedDisputeContext) {
  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, ctx.brandId),
    columns: { userId: true },
  });
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, ctx.creatorId),
    columns: { userId: true },
  });
  if (!brand || !creator) throw disputeError('INVALID_REFERENCE', 'Participants not found');
  return { brandUserId: brand.userId, creatorUserId: creator.userId };
}
