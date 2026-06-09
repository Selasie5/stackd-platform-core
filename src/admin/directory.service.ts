import { and, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { brands, creators, users } from '@/db/schema/index';
import { adminError } from '@/admin/errors';
import { adminListParams } from '@/admin/list.utils';

function formatAdminUserSummary(
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
    emailVerified: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  },
  brand?: { id: string; brandName: string; kycStatus: string } | null,
  creator?: { id: string; fullName: string; kycStatus: string } | null,
) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    brandName: brand?.brandName ?? null,
    fullName: creator?.fullName ?? null,
    kycStatus: brand?.kycStatus ?? creator?.kycStatus ?? null,
    brandId: brand?.id ?? null,
    creatorId: creator?.id ?? null,
  };
}

export async function listAdminUsers(filters: {
  role?: 'admin' | 'brand' | 'creator';
  status?: 'active' | 'suspended' | 'pending' | 'banned';
  search?: string;
  limit?: number;
}) {
  const { limit, search } = adminListParams(filters);
  const conditions: SQL[] = [isNull(users.deletedAt)];

  if (filters.role) conditions.push(eq(users.role, filters.role));
  if (filters.status) conditions.push(eq(users.status, filters.status));
  if (search) {
    conditions.push(
      or(
        ilike(users.email, `%${search}%`),
      )!,
    );
  }

  const rows = await db.query.users.findMany({
    where: and(...conditions),
    with: {
      brand: { columns: { id: true, brandName: true, kycStatus: true } },
      creator: { columns: { id: true, fullName: true, kycStatus: true } },
    },
    orderBy: [desc(users.createdAt)],
    limit,
  });

  return rows.map((row) => formatAdminUserSummary(row, row.brand, row.creator));
}

export async function getAdminUser(userId: string) {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)),
    with: {
      brand: {
        with: { wallet: true },
      },
      creator: {
        with: { wallet: true },
      },
    },
  });

  if (!user) throw adminError('NOT_FOUND', 'User not found');

  const summary = formatAdminUserSummary(user, user.brand, user.creator);

  return {
    ...summary,
    brandId: user.brand?.id ?? null,
    creatorId: user.creator?.id ?? null,
    brandWallet: user.brand?.wallet
      ? {
          id: user.brand.wallet.id,
          status: user.brand.wallet.status,
          availableBalance: user.brand.wallet.availableBalance,
          reservedBalance: user.brand.wallet.reservedBalance,
          currency: user.brand.wallet.currency,
        }
      : null,
    creatorWallet: user.creator?.wallet
      ? {
          id: user.creator.wallet.id,
          status: user.creator.wallet.status,
          availableBalance: user.creator.wallet.availableBalance,
          totalEarned: user.creator.wallet.totalEarned,
          currency: user.creator.wallet.currency,
        }
      : null,
  };
}

export async function listAdminBrands(filters: {
  kycStatus?: string;
  search?: string;
  limit?: number;
}) {
  const { limit, search } = adminListParams(filters);
  const conditions: SQL[] = [isNull(brands.deletedAt)];

  if (filters.kycStatus) {
    conditions.push(eq(brands.kycStatus, filters.kycStatus as 'approved'));
  }
  if (search) {
    conditions.push(ilike(brands.brandName, `%${search}%`));
  }

  const rows = await db.query.brands.findMany({
    where: and(...conditions),
    with: {
      user: { columns: { email: true } },
      wallet: true,
    },
    orderBy: [desc(brands.createdAt)],
    limit,
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    brandName: row.brandName,
    country: row.country,
    kycStatus: row.kycStatus,
    walletStatus: row.wallet?.status ?? null,
    availableBalance: row.wallet?.availableBalance ?? null,
    reservedBalance: row.wallet?.reservedBalance ?? null,
    currency: row.wallet?.currency ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listAdminCreators(filters: {
  kycStatus?: string;
  search?: string;
  limit?: number;
}) {
  const { limit, search } = adminListParams(filters);
  const conditions: SQL[] = [isNull(creators.deletedAt)];

  if (filters.kycStatus) {
    conditions.push(eq(creators.kycStatus, filters.kycStatus as 'approved'));
  }
  if (search) {
    conditions.push(
      or(ilike(creators.fullName, `%${search}%`), ilike(creators.school, `%${search}%`))!,
    );
  }

  const rows = await db.query.creators.findMany({
    where: and(...conditions),
    with: {
      user: { columns: { email: true } },
      wallet: true,
    },
    orderBy: [desc(creators.createdAt)],
    limit,
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    fullName: row.fullName,
    country: row.country,
    kycStatus: row.kycStatus,
    walletStatus: row.wallet?.status ?? null,
    availableBalance: row.wallet?.availableBalance ?? null,
    totalEarned: row.wallet?.totalEarned ?? null,
    currency: row.wallet?.currency ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
