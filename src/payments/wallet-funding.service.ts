import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '@/config/index';
import { db } from '@/db/client';
import { brandWallets, brands, users, walletTopUps } from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { notify } from '@/notifications/notification.service';
import { paymentError } from '@/payments/errors';
import { initializeTransaction, toPaystackAmount } from '@/payments/paystack.client';
import { creditFunds, getWallet } from '@/opportunities/wallet.service';

const initializeTopUpSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export function formatBrandWallet(row: {
  id: string;
  brandId: string;
  currency: 'NGN' | 'GHS' | 'USD';
  availableBalance: string;
  reservedBalance: string;
  totalSpent: string;
  status: 'active' | 'frozen' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    brandId: row.brandId,
    currency: row.currency,
    availableBalance: row.availableBalance,
    reservedBalance: row.reservedBalance,
    totalSpent: row.totalSpent,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getMyBrandWallet(session: SessionData) {
  if (!session.brandId) {
    throw paymentError('WALLET_NOT_FOUND', 'Brand wallet not found');
  }

  const wallet = await getWallet(session.brandId);
  return formatBrandWallet(wallet);
}

export async function initializeWalletTopUp(session: SessionData, amountInput: string) {
  if (!session.brandId) {
    throw paymentError('WALLET_NOT_FOUND', 'Brand wallet not found');
  }

  const { amount } = initializeTopUpSchema.parse({ amount: amountInput });
  const wallet = await getWallet(session.brandId);

  if (wallet.status !== 'active') {
    throw paymentError('WALLET_FROZEN', 'Wallet must be active before topping up');
  }

  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, session.brandId),
    columns: { id: true },
  });
  if (!brand) {
    throw paymentError('WALLET_NOT_FOUND', 'Brand not found');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { email: true },
  });
  if (!user) {
    throw paymentError('WALLET_NOT_FOUND', 'User not found');
  }

  const paystackReference = `topup_${randomUUID()}`;

  const [topUp] = await db
    .insert(walletTopUps)
    .values({
      brandId: session.brandId,
      amount,
      currency: wallet.currency,
      paystackReference,
      status: 'pending',
    })
    .returning();

  const paystackAmount = toPaystackAmount(amount, wallet.currency);

  const initialized = await initializeTransaction({
    email: user.email,
    amount: paystackAmount,
    currency: wallet.currency,
    reference: paystackReference,
    metadata: {
      type: 'wallet_topup',
      topUpId: topUp.id,
      brandId: session.brandId,
      userId: session.userId,
    },
    callbackUrl: `${config.FRONTEND_URL}/wallet?topup=success`,
  });

  return {
    topUpId: topUp.id,
    authorizationUrl: initialized.authorization_url,
    reference: initialized.reference,
    amount,
    currency: wallet.currency,
  };
}

export async function completeWalletTopUpFromWebhook(input: {
  topUpId: string;
  brandId: string;
  userId: string;
  paystackReference: string;
  amountPaid: number;
}): Promise<void> {
  const topUp = await db.query.walletTopUps.findFirst({
    where: eq(walletTopUps.id, input.topUpId),
  });

  if (!topUp) {
    throw paymentError('TOP_UP_NOT_FOUND', 'Wallet top-up not found');
  }

  if (topUp.status === 'completed') {
    return;
  }

  if (topUp.brandId !== input.brandId || topUp.paystackReference !== input.paystackReference) {
    throw paymentError('TOP_UP_NOT_FOUND', 'Wallet top-up reference mismatch');
  }

  const expectedKobo = toPaystackAmount(topUp.amount, topUp.currency);
  if (input.amountPaid < expectedKobo) {
    await db
      .update(walletTopUps)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(walletTopUps.id, topUp.id));
    return;
  }

  await creditFunds(topUp.brandId, topUp.amount, topUp.currency, {
    referenceType: 'wallet_topup',
    referenceId: topUp.id,
    description: `Wallet top-up via Paystack (${input.paystackReference})`,
  });

  await db
    .update(walletTopUps)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(walletTopUps.id, topUp.id));

  const wallet = await db.query.brandWallets.findFirst({
    where: eq(brandWallets.brandId, topUp.brandId),
  });

  await notify({
    userId: input.userId,
    type: 'wallet_funded',
    title: 'Wallet funded',
    body: `Your wallet has been credited with ${topUp.currency} ${topUp.amount}. Available balance: ${wallet?.availableBalance ?? topUp.amount}.`,
    referenceType: 'wallet_topup',
    referenceId: topUp.id,
  });
}
