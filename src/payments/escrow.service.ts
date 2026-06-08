import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { creators, payments } from '@/db/schema/index';
import { notify } from '@/notifications/notification.service';
import { paymentError } from '@/payments/errors';
import { loadOpportunity } from '@/opportunities/opportunity.loader';
import {
  formatAmount,
  parseAmount,
  releaseFunds,
  spendFromReserved,
} from '@/opportunities/wallet.service';
import type { OpportunityType } from '@/opportunities/types';
import { creditCreatorWallet } from '@/wallets/creator-wallet.service';

export type EscrowSubmissionType = 'ugc_submission' | 'cpm_submission' | 'contest_submission';

export interface AllocateEscrowInput {
  opportunityType: OpportunityType;
  opportunityId: string;
  submissionType: EscrowSubmissionType;
  submissionId: string;
  creatorId: string;
  amount: string;
  currency: 'NGN' | 'GHS' | 'USD';
}

const OPPORTUNITY_TYPE_MAP: Record<OpportunityType, string> = {
  UGC_ORDER: 'ugc_order',
  CPM_DEAL: 'cpm_deal',
  CONTEST: 'contest',
};

export async function getAllocatedAmountForOpportunity(opportunityId: string): Promise<number> {
  const rows = await db.query.payments.findMany({
    where: and(
      eq(payments.opportunityId, opportunityId),
      inArray(payments.status, ['in_escrow', 'ready_for_payout', 'paid']),
    ),
    columns: { amount: true },
  });
  return rows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
}

export async function getCampaignBudget(
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<string> {
  const record = await loadOpportunity(opportunityType, opportunityId);
  return record.budgetAmount;
}

export async function allocateEscrow(input: AllocateEscrowInput): Promise<void> {
  const amount = parseAmount(input.amount);
  if (amount <= 0) {
    throw paymentError('INVALID_AMOUNT', 'Escrow amount must be greater than zero');
  }

  const record = await loadOpportunity(input.opportunityType, input.opportunityId);
  if (!['live', 'closed', 'paused'].includes(record.status)) {
    throw paymentError('INVALID_AMOUNT', 'Cannot allocate escrow for this campaign status');
  }

  const budget = parseAmount(record.budgetAmount);
  const allocated = await getAllocatedAmountForOpportunity(input.opportunityId);
  if (allocated + amount > budget + 0.001) {
    throw paymentError('INVALID_AMOUNT', 'Escrow allocation exceeds campaign budget');
  }

  const existing = await db.query.payments.findFirst({
    where: and(
      eq(payments.referenceType, input.submissionType),
      eq(payments.referenceId, input.submissionId),
      inArray(payments.status, ['in_escrow', 'ready_for_payout', 'paid']),
    ),
  });
  if (existing) {
    throw paymentError('ESCROW_ALREADY_ALLOCATED', 'Escrow already allocated for this submission');
  }

  await db.insert(payments).values({
    creatorId: input.creatorId,
    referenceType: input.submissionType,
    referenceId: input.submissionId,
    opportunityType: OPPORTUNITY_TYPE_MAP[input.opportunityType],
    opportunityId: input.opportunityId,
    amount: formatAmount(amount),
    currency: input.currency,
    status: 'in_escrow',
  });
}

export async function releaseEscrowForOpportunity(
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<void> {
  const record = await loadOpportunity(opportunityType, opportunityId);
  const reference = {
    referenceType: OPPORTUNITY_TYPE_MAP[opportunityType] as 'ugc_order' | 'cpm_deal' | 'contest',
    referenceId: opportunityId,
    description: `Release escrow for ${record.title}`,
  };

  const escrowPayments = await db.query.payments.findMany({
    where: and(eq(payments.opportunityId, opportunityId), eq(payments.status, 'in_escrow')),
  });

  const totalRelease = escrowPayments.reduce((sum, p) => sum + parseAmount(p.amount), 0);

  for (const payment of escrowPayments) {
    await creditCreatorWallet(payment.creatorId, payment.amount, payment.currency, {
      referenceType: 'payment',
      referenceId: payment.id,
      description: `Escrow release for ${record.title}`,
    });

    await db
      .update(payments)
      .set({ status: 'ready_for_payout', updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    const creator = await db.query.creators.findFirst({
      where: eq(creators.id, payment.creatorId),
      columns: { userId: true },
    });
    if (creator) {
      await notify({
        userId: creator.userId,
        type: 'payment_ready',
        title: 'Earnings available',
        body: `Your earnings of ${payment.currency} ${payment.amount} from "${record.title}" are now in your wallet.`,
        referenceType: 'payment',
        referenceId: payment.id,
      });
    }
  }

  if (totalRelease > 0) {
    await spendFromReserved(record.brandId, formatAmount(totalRelease), record.currency, reference);
  }

  const budget = parseAmount(record.budgetAmount);
  const unused = Math.max(0, budget - totalRelease);
  if (unused > 0) {
    await releaseFunds(record.brandId, formatAmount(unused), record.currency, {
      ...reference,
      description: `Return unused campaign budget for ${record.title}`,
    });
  }
}
