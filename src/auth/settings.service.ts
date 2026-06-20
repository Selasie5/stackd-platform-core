import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { brands, sessions, users } from '@/db/schema/index';
import { hashPassword, verifyPassword } from '@/auth/password';
import { authError } from '@/auth/errors';
import { revokeSession } from '@/auth/session.service';
import { redisClient } from '@/queues/client';
import { buildSessionKey } from '@/auth/constants';

export interface BrandProfile {
  id: string;
  brandName: string;
  contactName: string | null;
  city: string | null;
  country: string;
  industry: string | null;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  kycStatus: string;
  createdAt: string;
}

export interface UpdateBrandInput {
  brandName?: string;
  contactName?: string;
  city?: string;
  country?: string;
  industry?: string;
  description?: string;
  website?: string | null;
  logoUrl?: string | null;
}

export interface ActiveSession {
  id: string;
  deviceName: string;
  platform: string;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

function parseUserAgent(ua: string | null): { deviceName: string; platform: string } {
  if (!ua) return { deviceName: 'Unknown', platform: 'web' };

  const lower = ua.toLowerCase();
  let platform = 'web';
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    platform = 'mobile';
  }

  let deviceName = 'Unknown';
  if (lower.includes('chrome')) deviceName = 'Chrome';
  else if (lower.includes('firefox')) deviceName = 'Firefox';
  else if (lower.includes('safari') && !lower.includes('chrome')) deviceName = 'Safari';
  else if (lower.includes('edge')) deviceName = 'Edge';
  else if (lower.includes('opera')) deviceName = 'Opera';
  else deviceName = ua.split('/')[0] ?? 'Unknown';

  return { deviceName, platform };
}

export async function getBrand(userId: string): Promise<BrandProfile | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { brand: true },
  });

  if (!user?.brand) return null;

  const brand = user.brand;
  return {
    id: brand.id,
    brandName: brand.brandName,
    contactName: brand.contactName,
    city: brand.city,
    country: brand.country,
    industry: brand.industry,
    description: brand.description,
    website: brand.website,
    logoUrl: brand.logoUrl,
    kycStatus: brand.kycStatus,
    createdAt: brand.createdAt.toISOString(),
  };
}

export async function updateBrand(
  userId: string,
  input: UpdateBrandInput,
): Promise<BrandProfile> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { brand: true },
  });

  if (!user?.brand) {
    throw authError('USER_NOT_FOUND', 'Brand profile not found');
  }

  const [updated] = await db
    .update(brands)
    .set({
      brandName: input.brandName,
      contactName: input.contactName,
      city: input.city,
      country: input.country,
      industry: input.industry,
      description: input.description,
      website: input.website,
      logoUrl: input.logoUrl,
      updatedAt: new Date(),
    })
    .where(eq(brands.id, user.brand.id))
    .returning();

  return {
    id: updated.id,
    brandName: updated.brandName,
    contactName: updated.contactName,
    city: updated.city,
    country: updated.country,
    industry: updated.industry,
    description: updated.description,
    website: updated.website,
    logoUrl: updated.logoUrl,
    kycStatus: updated.kycStatus,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw authError('USER_NOT_FOUND', 'User not found');
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw authError('INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

  return true;
}

export async function getActiveSessions(
  userId: string,
  currentSessionToken: string,
): Promise<ActiveSession[]> {
  const rows = await db.query.sessions.findMany({
    where: and(eq(sessions.userId, userId), isNull(sessions.revokedAt)),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  return rows.map((row) => {
    const parsed = parseUserAgent(row.userAgent);
    return {
      id: row.id,
      deviceName: parsed.deviceName,
      platform: parsed.platform,
      ipAddress: row.ipAddress,
      lastActiveAt: row.createdAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      isCurrent: row.token === currentSessionToken,
    };
  });
}

export async function revokeSessionById(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
  });

  if (!session) {
    throw authError('USER_NOT_FOUND', 'Session not found');
  }

  await redisClient.del(buildSessionKey(session.token));
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  return true;
}
