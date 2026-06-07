import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { brandWallets, walletTransactions } from '@/db/schema/index';
import { opportunityError } from '@/opportunities/errors';
import type { WalletReference } from '@/opportunities/types';

function parseAmount(value: string): number {
  return parseFloat(value);
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

async function getWallet(brandId: string) {
  const wallet = await db.query.brandWallets.findFirst({
    where: eq(brandWallets.brandId, brandId),
  });

  if (!wallet) {
    throw opportunityError('WALLET_NOT_FOUND', 'Brand wallet not found');
  }

  return wallet;
}

export async function reserveFunds(
  brandId: string,
  amount: string,
  currency: 'NGN' | 'GHS' | 'USD',
  reference: WalletReference,
): Promise<void> {
  const reserveAmount = parseAmount(amount);
  if (reserveAmount <= 0) {
    throw opportunityError('INVALID_STATUS', 'Budget amount must be greater than zero');
  }

  await db.transaction(async (tx) => {
    const wallet = await tx.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });

    if (!wallet) {
      throw opportunityError('WALLET_NOT_FOUND', 'Brand wallet not found');
    }

    if (wallet.status !== 'active') {
      throw opportunityError('WALLET_FROZEN', 'Wallet must be active before launching opportunities');
    }

    if (wallet.currency !== currency) {
      throw opportunityError('INVALID_STATUS', 'Opportunity currency must match wallet currency');
    }

    const available = parseAmount(wallet.availableBalance);
    if (available < reserveAmount) {
      throw opportunityError(
        'INSUFFICIENT_WALLET_BALANCE',
        'Insufficient wallet balance to reserve campaign budget',
      );
    }

    const reserved = parseAmount(wallet.reservedBalance);
    const newAvailable = formatAmount(available - reserveAmount);
    const newReserved = formatAmount(reserved + reserveAmount);

    await tx
      .update(brandWallets)
      .set({
        availableBalance: newAvailable,
        reservedBalance: newReserved,
        updatedAt: new Date(),
      })
      .where(eq(brandWallets.id, wallet.id));

    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      brandId,
      transactionType: 'reserve',
      amount: formatAmount(reserveAmount),
      currency,
      balanceBefore: wallet.availableBalance,
      balanceAfter: newAvailable,
      reservedBefore: wallet.reservedBalance,
      reservedAfter: newReserved,
      description: reference.description,
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
    });
  });
}

export async function releaseFunds(
  brandId: string,
  amount: string,
  currency: 'NGN' | 'GHS' | 'USD',
  reference: WalletReference,
): Promise<void> {
  const releaseAmount = parseAmount(amount);
  if (releaseAmount <= 0) return;

  await db.transaction(async (tx) => {
    const wallet = await tx.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });

    if (!wallet) {
      throw opportunityError('WALLET_NOT_FOUND', 'Brand wallet not found');
    }

    const available = parseAmount(wallet.availableBalance);
    const reserved = parseAmount(wallet.reservedBalance);
    const newAvailable = formatAmount(available + releaseAmount);
    const newReserved = formatAmount(Math.max(0, reserved - releaseAmount));

    await tx
      .update(brandWallets)
      .set({
        availableBalance: newAvailable,
        reservedBalance: newReserved,
        updatedAt: new Date(),
      })
      .where(eq(brandWallets.id, wallet.id));

    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      brandId,
      transactionType: 'release',
      amount: formatAmount(releaseAmount),
      currency,
      balanceBefore: wallet.availableBalance,
      balanceAfter: newAvailable,
      reservedBefore: wallet.reservedBalance,
      reservedAfter: newReserved,
      description: reference.description,
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
    });
  });
}

export async function finalizeSpend(
  brandId: string,
  amount: string,
  currency: 'NGN' | 'GHS' | 'USD',
  reference: WalletReference,
): Promise<void> {
  const spendAmount = parseAmount(amount);
  if (spendAmount <= 0) return;

  await db.transaction(async (tx) => {
    const wallet = await tx.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });

    if (!wallet) {
      throw opportunityError('WALLET_NOT_FOUND', 'Brand wallet not found');
    }

    const reserved = parseAmount(wallet.reservedBalance);
    const totalSpent = parseAmount(wallet.totalSpent);
    const newReserved = formatAmount(Math.max(0, reserved - spendAmount));
    const newTotalSpent = formatAmount(totalSpent + spendAmount);

    await tx
      .update(brandWallets)
      .set({
        reservedBalance: newReserved,
        totalSpent: newTotalSpent,
        updatedAt: new Date(),
      })
      .where(eq(brandWallets.id, wallet.id));

    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      brandId,
      transactionType: 'debit',
      amount: formatAmount(spendAmount),
      currency,
      balanceBefore: wallet.availableBalance,
      balanceAfter: wallet.availableBalance,
      reservedBefore: wallet.reservedBalance,
      reservedAfter: newReserved,
      description: reference.description,
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
    });
  });
}

export { getWallet, parseAmount, formatAmount };
