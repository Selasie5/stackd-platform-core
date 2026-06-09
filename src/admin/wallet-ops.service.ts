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

export async function setWalletStatus(
  profileType: WalletProfileType,
  profileId: string,
  status: 'active' | 'frozen',
  reason: string,
  options?: { skipAlreadyCheck?: boolean },
): Promise<void> {
  if (profileType === 'brand') {
    const wallet = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, profileId),
    });
    if (!wallet) throw adminError('NOT_FOUND', 'Brand wallet not found');
    if (!options?.skipAlreadyCheck) {
      if (status === 'frozen' && wallet.status === 'frozen') {
        throw adminError('INVALID_STATUS', 'Wallet is already frozen');
      }
      if (status === 'active' && wallet.status !== 'frozen') {
        throw adminError('INVALID_STATUS', 'Wallet is not frozen');
      }
    }

    await db
      .update(brandWallets)
      .set({ status, updatedAt: new Date() })
      .where(eq(brandWallets.id, wallet.id));
  } else {
    const wallet = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, profileId),
    });
    if (!wallet) throw adminError('NOT_FOUND', 'Creator wallet not found');
    if (!options?.skipAlreadyCheck) {
      if (status === 'frozen' && wallet.status === 'frozen') {
        throw adminError('INVALID_STATUS', 'Wallet is already frozen');
      }
      if (status === 'active' && wallet.status !== 'frozen') {
        throw adminError('INVALID_STATUS', 'Wallet is not frozen');
      }
    }

    await db
      .update(creatorWallets)
      .set({ status, updatedAt: new Date() })
      .where(eq(creatorWallets.id, wallet.id));
  }

  const userId = await getWalletOwnerUserId(profileType, profileId);
  await notify({
    userId,
    type: status === 'frozen' ? 'wallet_frozen' : 'wallet_unfrozen',
    title: status === 'frozen' ? 'Wallet frozen' : 'Wallet unfrozen',
    body: reason,
    referenceType: profileType === 'brand' ? 'brand' : 'creator',
    referenceId: profileId,
  });
}

export async function freezeWallet(_session: SessionData, input: unknown) {
  const data = walletActionSchema.parse(input);
  await setWalletStatus(data.profileType, data.profileId, 'frozen', data.reason);
  return data.profileType === 'brand'
    ? getAdminBrandWallet(data.profileId)
    : getAdminCreatorWallet(data.profileId);
}

export async function unfreezeWallet(_session: SessionData, input: unknown) {
  const data = walletActionSchema.parse(input);
  await setWalletStatus(data.profileType, data.profileId, 'active', data.reason);
  return data.profileType === 'brand'
    ? getAdminBrandWallet(data.profileId)
    : getAdminCreatorWallet(data.profileId);
}
