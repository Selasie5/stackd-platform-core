import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { deviceTokens } from '@/db/schema/index';

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: string,
): Promise<boolean> {
  const existing = await db.query.deviceTokens.findFirst({
    where: and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)),
  });

  if (existing) {
    await db
      .update(deviceTokens)
      .set({ lastUsedAt: new Date(), platform })
      .where(eq(deviceTokens.id, existing.id));
    return true;
  }

  await db.insert(deviceTokens).values({ userId, token, platform });
  return true;
}

export async function removeDeviceToken(userId: string, token: string): Promise<boolean> {
  const existing = await db.query.deviceTokens.findFirst({
    where: and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)),
  });

  if (!existing) return false;

  await db.delete(deviceTokens).where(eq(deviceTokens.id, existing.id));
  return true;
}
