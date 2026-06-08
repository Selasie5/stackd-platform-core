import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { creators } from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { paymentError } from '@/payments/errors';

const bankTransferSchema = z.object({
  method: z.literal('bank_transfer'),
  bankName: z.string().min(1),
  bankCode: z.string().min(1),
  accountNumber: z.string().min(5),
  accountName: z.string().min(1),
});

const mobileMoneySchema = z.object({
  method: z.literal('mobile_money'),
  mobileMoneyNumber: z.string().min(5),
  mobileMoneyProvider: z.string().min(1),
  accountName: z.string().min(1),
});

const paymentDetailsSchema = z.discriminatedUnion('method', [
  bankTransferSchema,
  mobileMoneySchema,
]);

export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;

export async function updatePaymentDetails(session: SessionData, input: PaymentDetailsInput) {
  if (!session.creatorId) {
    throw paymentError('FORBIDDEN', 'Only creators can update payment details');
  }

  const parsed = paymentDetailsSchema.parse(input);

  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, session.creatorId),
    columns: { paymentDetails: true },
  });
  if (!creator) {
    throw paymentError('WALLET_NOT_FOUND', 'Creator not found');
  }

  const existingRecipientCode = creator.paymentDetails?.paystackRecipientCode;

  await db
    .update(creators)
    .set({
      paymentDetails: {
        ...parsed,
        paystackRecipientCode: existingRecipientCode,
      },
      updatedAt: new Date(),
    })
    .where(eq(creators.id, session.creatorId));

  return getPaymentDetails(session);
}

export async function getPaymentDetails(session: SessionData) {
  if (!session.creatorId) {
    throw paymentError('FORBIDDEN', 'Only creators can view payment details');
  }

  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, session.creatorId),
    columns: { paymentDetails: true },
  });
  if (!creator) {
    throw paymentError('WALLET_NOT_FOUND', 'Creator not found');
  }

  const details = creator.paymentDetails;
  if (!details) return null;

  return {
    method: details.method,
    bankName: details.bankName ?? null,
    bankCode: details.bankCode ?? null,
    accountNumber: details.accountNumber ?? null,
    accountName: details.accountName ?? null,
    mobileMoneyNumber: details.mobileMoneyNumber ?? null,
    mobileMoneyProvider: details.mobileMoneyProvider ?? null,
    hasPaystackRecipient: Boolean(details.paystackRecipientCode),
  };
}
