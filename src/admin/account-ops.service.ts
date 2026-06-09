import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { brands, creators, users } from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { adminError } from '@/admin/errors';
import { getAdminBrand, getAdminCreator } from '@/admin/directory.service';
import { applyUserStatusChange } from '@/admin/user-ops.service';
import { setWalletStatus } from '@/admin/wallet-ops.service';

async function resolveBrandUser(brandId: string) {
  const brand = await db.query.brands.findFirst({
    where: and(eq(brands.id, brandId), isNull(brands.deletedAt)),
    columns: { userId: true },
  });
  if (!brand) throw adminError('NOT_FOUND', 'Brand not found');

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, brand.userId), isNull(users.deletedAt)),
  });
  if (!user) throw adminError('NOT_FOUND', 'User not found');
  if (user.role === 'admin') {
    throw adminError('CANNOT_MODIFY_ADMIN', 'Cannot change status of admin accounts');
  }

  return { userId: brand.userId, user };
}

async function resolveCreatorUser(creatorId: string) {
  const creator = await db.query.creators.findFirst({
    where: and(eq(creators.id, creatorId), isNull(creators.deletedAt)),
    columns: { userId: true },
  });
  if (!creator) throw adminError('NOT_FOUND', 'Creator not found');

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, creator.userId), isNull(users.deletedAt)),
  });
  if (!user) throw adminError('NOT_FOUND', 'User not found');
  if (user.role === 'admin') {
    throw adminError('CANNOT_MODIFY_ADMIN', 'Cannot change status of admin accounts');
  }

  return { userId: creator.userId, user };
}

export async function suspendBrand(session: SessionData, brandId: string, reason: string) {
  const { userId } = await resolveBrandUser(brandId);
  if (userId === session.userId) {
    throw adminError('FORBIDDEN', 'You cannot suspend your own account');
  }

  await applyUserStatusChange(session, { userId, status: 'suspended', reason });
  await setWalletStatus('brand', brandId, 'frozen', reason, { skipAlreadyCheck: true });
  return getAdminBrand(brandId);
}

export async function restoreBrand(session: SessionData, brandId: string, reason: string) {
  const { userId, user } = await resolveBrandUser(brandId);

  if (user.status !== 'suspended') {
    throw adminError('INVALID_STATUS', 'Brand account is not suspended');
  }

  await applyUserStatusChange(session, { userId, status: 'active', reason });
  await setWalletStatus('brand', brandId, 'active', reason, { skipAlreadyCheck: true });
  return getAdminBrand(brandId);
}

export async function suspendCreator(session: SessionData, creatorId: string, reason: string) {
  const { userId } = await resolveCreatorUser(creatorId);
  if (userId === session.userId) {
    throw adminError('FORBIDDEN', 'You cannot suspend your own account');
  }

  await applyUserStatusChange(session, { userId, status: 'suspended', reason });
  await setWalletStatus('creator', creatorId, 'frozen', reason, { skipAlreadyCheck: true });
  return getAdminCreator(creatorId);
}

export async function restoreCreator(session: SessionData, creatorId: string, reason: string) {
  const { userId, user } = await resolveCreatorUser(creatorId);

  if (user.status !== 'suspended') {
    throw adminError('INVALID_STATUS', 'Creator account is not suspended');
  }

  await applyUserStatusChange(session, { userId, status: 'active', reason });
  await setWalletStatus('creator', creatorId, 'active', reason, { skipAlreadyCheck: true });
  return getAdminCreator(creatorId);
}
