import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { creators, withdrawals } from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { notify } from '@/notifications/notification.service';
import { paymentError } from '@/payments/errors';
import { formatWithdrawal } from '@/payments/ledger.service';
import {
  createTransferRecipient,
  initiateTransfer,
  toPaystackAmount,
} from '@/payments/paystack.client';
import {
  debitCreatorWallet,
  getCreatorWallet,
  reverseCreatorPayout,
} from '@/wallets/creator-wallet.service';

const requestWithdrawalSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

type CreatorPaymentDetails = {
  method: 'bank_transfer' | 'mobile_money';
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  mobileMoneyNumber?: string;
  mobileMoneyProvider?: string;
  paystackRecipientCode?: string;
};

async function resolveRecipientCode(
  creatorId: string,
  details: CreatorPaymentDetails,
): Promise<string> {
  if (details.paystackRecipientCode) {
    return details.paystackRecipientCode;
  }

  const accountNumber =
    details.method === 'bank_transfer' ? details.accountNumber : details.mobileMoneyNumber;
  const bankCode =
    details.method === 'bank_transfer' ? details.bankCode : details.mobileMoneyProvider;
  const accountName = details.accountName;

  if (!accountNumber || !bankCode || !accountName) {
    throw paymentError('PAYMENT_DETAILS_REQUIRED', 'Complete payment details are required');
  }

  const wallet = await getCreatorWallet(creatorId);
  const recipient = await createTransferRecipient({
    type: details.method === 'bank_transfer' ? 'nuban' : 'mobile_money',
    name: accountName,
    accountNumber,
    bankCode,
    currency: wallet.currency,
  });

  await db
    .update(creators)
    .set({
      paymentDetails: { ...details, paystackRecipientCode: recipient.recipient_code },
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId));

  return recipient.recipient_code;
}

export async function requestWithdrawal(session: SessionData, amountInput: string) {
  if (!session.creatorId) {
    throw paymentError('FORBIDDEN', 'Only creators can request withdrawals');
  }

  const { amount } = requestWithdrawalSchema.parse({ amount: amountInput });
  const wallet = await getCreatorWallet(session.creatorId);

  if (wallet.status !== 'active') {
    throw paymentError('WALLET_FROZEN', 'Creator wallet must be active before withdrawing');
  }

  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, session.creatorId),
    columns: { paymentDetails: true, userId: true },
  });
  if (!creator?.paymentDetails) {
    throw paymentError('PAYMENT_DETAILS_REQUIRED', 'Set payment details before withdrawing');
  }

  const activeWithdrawal = await db.query.withdrawals.findFirst({
    where: and(
      eq(withdrawals.creatorId, session.creatorId),
      inArray(withdrawals.status, ['pending', 'processing']),
    ),
  });
  if (activeWithdrawal) {
    throw paymentError('WITHDRAWAL_IN_PROGRESS', 'A withdrawal is already in progress');
  }

  const available = parseFloat(wallet.availableBalance);
  const requested = parseFloat(amount);
  if (requested <= 0 || requested > available) {
    throw paymentError('INSUFFICIENT_BALANCE', 'Insufficient wallet balance for withdrawal');
  }

  const paystackReference = `withdraw_${randomUUID()}`;
  const paymentDetailsSnapshot = {
    method: creator.paymentDetails.method,
    bankName: creator.paymentDetails.bankName,
    bankCode: creator.paymentDetails.bankCode,
    accountNumber: creator.paymentDetails.accountNumber,
    accountName: creator.paymentDetails.accountName,
    mobileMoneyNumber: creator.paymentDetails.mobileMoneyNumber,
    mobileMoneyProvider: creator.paymentDetails.mobileMoneyProvider,
  };

  const [withdrawal] = await db
    .insert(withdrawals)
    .values({
      creatorId: session.creatorId,
      walletId: wallet.id,
      amount,
      currency: wallet.currency,
      paystackReference,
      status: 'pending',
      paymentDetailsSnapshot,
    })
    .returning();

  try {
    const recipientCode = await resolveRecipientCode(session.creatorId, creator.paymentDetails);

    const transfer = await initiateTransfer({
      amount: toPaystackAmount(amount, wallet.currency),
      recipientCode,
      reason: 'Spleenet creator payout',
      reference: paystackReference,
      currency: wallet.currency,
    });

    await debitCreatorWallet(session.creatorId, amount, wallet.currency, {
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      description: `Withdrawal to ${creator.paymentDetails.method === 'bank_transfer' ? 'bank' : 'mobile money'}`,
    });

    const [updated] = await db
      .update(withdrawals)
      .set({
        status: 'processing',
        paystackStatus: transfer.status,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id))
      .returning();

    return formatWithdrawal(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Withdrawal failed';
    await db
      .update(withdrawals)
      .set({
        status: 'failed',
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id));
    throw error;
  }
}

export async function completeWithdrawalFromWebhook(input: {
  paystackReference: string;
  event: 'transfer.success' | 'transfer.failed';
  paystackStatus?: string;
  failureReason?: string;
}): Promise<void> {
  const withdrawal = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.paystackReference, input.paystackReference),
  });

  if (!withdrawal) {
    throw paymentError('WITHDRAWAL_NOT_FOUND', 'Withdrawal not found');
  }

  if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
    return;
  }

  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, withdrawal.creatorId),
    columns: { userId: true },
  });
  if (!creator) return;

  if (input.event === 'transfer.success') {
    await db
      .update(withdrawals)
      .set({
        status: 'completed',
        paystackStatus: input.paystackStatus ?? 'success',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id));

    await notify({
      userId: creator.userId,
      type: 'payment_paid',
      title: 'Withdrawal completed',
      body: `Your withdrawal of ${withdrawal.currency} ${withdrawal.amount} has been sent to your account.`,
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
    });
    return;
  }

  if (withdrawal.status === 'processing') {
    await reverseCreatorPayout(withdrawal.creatorId, withdrawal.amount, withdrawal.currency, {
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      description: `Reversal of failed withdrawal (${input.paystackReference})`,
    });
  }

  await db
    .update(withdrawals)
    .set({
      status: 'failed',
      paystackStatus: input.paystackStatus ?? 'failed',
      failureReason: input.failureReason ?? 'Transfer failed',
      updatedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawal.id));

  await notify({
    userId: creator.userId,
    type: 'payment_paid',
    title: 'Withdrawal failed',
    body: `Your withdrawal of ${withdrawal.currency} ${withdrawal.amount} could not be completed. Funds have been returned to your wallet.`,
    referenceType: 'withdrawal',
    referenceId: withdrawal.id,
  });
}
