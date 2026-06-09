import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  brandWallets,
  brands,
  creatorWalletTransactions,
  creatorWallets,
  creators,
  walletTopUps,
  walletTransactions,
} from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { adminError } from '@/admin/errors';
import { clampLimit } from '@/admin/list.utils';
import type { WalletProfileType } from '@/admin/types';
import { notify } from '@/notifications/notification.service';
import {
  formatBrandWalletTransaction,
  formatCreatorWalletTransaction,
  formatWalletTopUp,
} from '@/payments/ledger.service';
import { formatBrandWallet } from '@/payments/wallet-funding.service';
import { formatCreatorWallet } from '@/wallets/creator-wallet.service';

const walletActionSchema = z.object({
  profileType: z.enum(['brand', 'creator']),
  profileId: z.string().uuid(),
  reason: z.string().min(1),
});

export async function getAdminBrandWallet(brandId: string, transactionLimit = 20) {
  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, brandId),
    with: { wallet: true },
  });
  if (!brand?.wallet) throw adminError('NOT_FOUND', 'Brand wallet not found');

  const transactions = await db.query.walletTransactions.findMany({
    where: eq(walletTransactions.brandId, brandId),
    orderBy: [desc(walletTransactions.createdAt)],
    limit: clampLimit(transactionLimit),
  });

  return {
    wallet: formatBrandWallet(brand.wallet),
    brandName: brand.brandName,
    transactions: transactions.map(formatBrandWalletTransaction),
  };
}

export async function getAdminCreatorWallet(creatorId: string, transactionLimit = 20) {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
    with: { wallet: true },
  });
  if (!creator?.wallet) throw adminError('NOT_FOUND', 'Creator wallet not found');

  const transactions = await db.query.creatorWalletTransactions.findMany({
    where: eq(creatorWalletTransactions.creatorId, creatorId),
    orderBy: [desc(creatorWalletTransactions.createdAt)],
    limit: clampLimit(transactionLimit),
  });

  return {
    wallet: formatCreatorWallet(creator.wallet),
    fullName: creator.fullName,
    transactions: transactions.map(formatCreatorWalletTransaction),
  };
}

export async function listAdminWalletTopUps(filters: {
  brandId?: string;
  status?: 'pending' | 'completed' | 'failed';
  limit?: number;
}) {
  const conditions = [];
  if (filters.brandId) conditions.push(eq(walletTopUps.brandId, filters.brandId));
  if (filters.status) conditions.push(eq(walletTopUps.status, filters.status));

  const rows = await db.query.walletTopUps.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(walletTopUps.createdAt)],
    limit: clampLimit(filters.limit),
  });

  return rows.map(formatWalletTopUp);
}

async function getWalletOwnerUserId(
  profileType: WalletProfileType,
  profileId: string,
): Promise<string> {
  if (profileType === 'brand') {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, profileId),
      columns: { userId: true },
    });
    if (!brand) throw adminError('NOT_FOUND', 'Brand not found');
    return brand.userId;
  }

  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, profileId),
    columns: { userId: true },
  });
  if (!creator) throw adminError('NOT_FOUND', 'Creator not found');
  return creator.userId;
}

export async function freezeWallet(_session: SessionData, input: unknown) {
  const data = walletActionSchema.parse(input);

  if (data.profileType === 'brand') {
    const wallet = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, data.profileId),
    });
    if (!wallet) throw adminError('NOT_FOUND', 'Brand wallet not found');
    if (wallet.status === 'frozen') {
      throw adminError('INVALID_STATUS', 'Wallet is already frozen');
    }

    await db
      .update(brandWallets)
      .set({ status: 'frozen', updatedAt: new Date() })
      .where(eq(brandWallets.id, wallet.id));
  } else {
    const wallet = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, data.profileId),
    });
    if (!wallet) throw adminError('NOT_FOUND', 'Creator wallet not found');
    if (wallet.status === 'frozen') {
      throw adminError('INVALID_STATUS', 'Wallet is already frozen');
    }

    await db
      .update(creatorWallets)
      .set({ status: 'frozen', updatedAt: new Date() })
      .where(eq(creatorWallets.id, wallet.id));
  }

  const userId = await getWalletOwnerUserId(data.profileType, data.profileId);
  await notify({
    userId,
    type: 'wallet_frozen',
    title: 'Wallet frozen',
    body: data.reason,
    referenceType: data.profileType === 'brand' ? 'brand' : 'creator',
    referenceId: data.profileId,
  });

  return data.profileType === 'brand'
    ? getAdminBrandWallet(data.profileId)
    : getAdminCreatorWallet(data.profileId);
}

export async function unfreezeWallet(_session: SessionData, input: unknown) {
  const data = walletActionSchema.parse(input);

  if (data.profileType === 'brand') {
    const wallet = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, data.profileId),
    });
    if (!wallet) throw adminError('NOT_FOUND', 'Brand wallet not found');
    if (wallet.status !== 'frozen') {
      throw adminError('INVALID_STATUS', 'Wallet is not frozen');
    }

    await db
      .update(brandWallets)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(brandWallets.id, wallet.id));
  } else {
    const wallet = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, data.profileId),
    });
    if (!wallet) throw adminError('NOT_FOUND', 'Creator wallet not found');
    if (wallet.status !== 'frozen') {
      throw adminError('INVALID_STATUS', 'Wallet is not frozen');
    }

    await db
      .update(creatorWallets)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(creatorWallets.id, wallet.id));
  }

  const userId = await getWalletOwnerUserId(data.profileType, data.profileId);
  await notify({
    userId,
    type: 'wallet_unfrozen',
    title: 'Wallet unfrozen',
    body: data.reason,
    referenceType: data.profileType === 'brand' ? 'brand' : 'creator',
    referenceId: data.profileId,
  });

  return data.profileType === 'brand'
    ? getAdminBrandWallet(data.profileId)
    : getAdminCreatorWallet(data.profileId);
}
