import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { creatorWalletTransactions, creatorWallets, creators } from '@/db/schema/index';
import { opportunityError } from '@/opportunities/errors';
import { formatAmount, parseAmount } from '@/opportunities/wallet.service';

export interface CreatorWalletReference {
  referenceType: string;
  referenceId: string;
  description: string;
}

export async function getCreatorWallet(creatorId: string) {
  const wallet = await db.query.creatorWallets.findFirst({
    where: eq(creatorWallets.creatorId, creatorId),
  });
  if (!wallet) {
    throw opportunityError('WALLET_NOT_FOUND', 'Creator wallet not found');
  }
  return wallet;
}

export async function ensureCreatorWallet(
  creatorId: string,
  currency: 'NGN' | 'GHS' | 'USD',
): Promise<void> {
  const existing = await db.query.creatorWallets.findFirst({
    where: eq(creatorWallets.creatorId, creatorId),
  });
  if (existing) return;

  await db.insert(creatorWallets).values({
    creatorId,
    currency,
    status: 'frozen',
  });
}

export async function creditCreatorWallet(
  creatorId: string,
  amount: string,
  currency: 'NGN' | 'GHS' | 'USD',
  reference: CreatorWalletReference,
): Promise<void> {
  const creditAmount = parseAmount(amount);
  if (creditAmount <= 0) return;

  await db.transaction(async (tx) => {
    const wallet = await tx.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    if (!wallet) {
      throw opportunityError('WALLET_NOT_FOUND', 'Creator wallet not found');
    }
    if (wallet.currency !== currency) {
      throw opportunityError('INVALID_STATUS', 'Currency must match creator wallet');
    }

    const available = parseAmount(wallet.availableBalance);
    const totalEarned = parseAmount(wallet.totalEarned);
    const newAvailable = formatAmount(available + creditAmount);
    const newTotalEarned = formatAmount(totalEarned + creditAmount);

    await tx
      .update(creatorWallets)
      .set({
        availableBalance: newAvailable,
        totalEarned: newTotalEarned,
        updatedAt: new Date(),
      })
      .where(eq(creatorWallets.id, wallet.id));

    await tx.insert(creatorWalletTransactions).values({
      walletId: wallet.id,
      creatorId,
      transactionType: 'credit',
      amount: formatAmount(creditAmount),
      currency,
      balanceBefore: wallet.availableBalance,
      balanceAfter: newAvailable,
      description: reference.description,
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
    });

    await tx
      .update(creators)
      .set({
        totalEarnings: newTotalEarned,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, creatorId));
  });
}

export async function debitCreatorWallet(
  creatorId: string,
  amount: string,
  currency: 'NGN' | 'GHS' | 'USD',
  reference: CreatorWalletReference,
): Promise<void> {
  const debitAmount = parseAmount(amount);
  if (debitAmount <= 0) {
    throw opportunityError('INVALID_STATUS', 'Debit amount must be greater than zero');
  }

  await db.transaction(async (tx) => {
    const wallet = await tx.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    if (!wallet) {
      throw opportunityError('WALLET_NOT_FOUND', 'Creator wallet not found');
    }
    if (wallet.status !== 'active') {
      throw opportunityError('WALLET_FROZEN', 'Creator wallet must be active');
    }
    if (wallet.currency !== currency) {
      throw opportunityError('INVALID_STATUS', 'Currency must match creator wallet');
    }

    const available = parseAmount(wallet.availableBalance);
    if (available < debitAmount) {
      throw opportunityError('INSUFFICIENT_WALLET_BALANCE', 'Insufficient wallet balance');
    }

    const totalWithdrawn = parseAmount(wallet.totalWithdrawn);
    const newAvailable = formatAmount(available - debitAmount);
    const newTotalWithdrawn = formatAmount(totalWithdrawn + debitAmount);

    await tx
      .update(creatorWallets)
      .set({
        availableBalance: newAvailable,
        totalWithdrawn: newTotalWithdrawn,
        updatedAt: new Date(),
      })
      .where(eq(creatorWallets.id, wallet.id));

    await tx.insert(creatorWalletTransactions).values({
      walletId: wallet.id,
      creatorId,
      transactionType: 'payout',
      amount: formatAmount(debitAmount),
      currency,
      balanceBefore: wallet.availableBalance,
      balanceAfter: newAvailable,
      description: reference.description,
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
    });
  });
}

export async function reverseCreatorPayout(
  creatorId: string,
  amount: string,
  currency: 'NGN' | 'GHS' | 'USD',
  reference: CreatorWalletReference,
): Promise<void> {
  const reverseAmount = parseAmount(amount);
  if (reverseAmount <= 0) return;

  await db.transaction(async (tx) => {
    const wallet = await tx.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    if (!wallet) {
      throw opportunityError('WALLET_NOT_FOUND', 'Creator wallet not found');
    }

    const available = parseAmount(wallet.availableBalance);
    const totalWithdrawn = parseAmount(wallet.totalWithdrawn);
    const newAvailable = formatAmount(available + reverseAmount);
    const newTotalWithdrawn = formatAmount(Math.max(0, totalWithdrawn - reverseAmount));

    await tx
      .update(creatorWallets)
      .set({
        availableBalance: newAvailable,
        totalWithdrawn: newTotalWithdrawn,
        updatedAt: new Date(),
      })
      .where(eq(creatorWallets.id, wallet.id));

    await tx.insert(creatorWalletTransactions).values({
      walletId: wallet.id,
      creatorId,
      transactionType: 'refund',
      amount: formatAmount(reverseAmount),
      currency,
      balanceBefore: wallet.availableBalance,
      balanceAfter: newAvailable,
      description: reference.description,
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
    });
  });
}

export function formatCreatorWallet(row: {
  id: string;
  creatorId: string;
  currency: 'NGN' | 'GHS' | 'USD';
  availableBalance: string;
  totalEarned: string;
  totalWithdrawn: string;
  status: 'active' | 'frozen' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    creatorId: row.creatorId,
    currency: row.currency,
    availableBalance: row.availableBalance,
    totalEarned: row.totalEarned,
    totalWithdrawn: row.totalWithdrawn,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
