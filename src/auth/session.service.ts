import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions } from '@/db/schema/index';
import { redisClient } from '@/queues/client';
import { buildSessionKey, SESSION_TTL_SECONDS } from '@/auth/constants';
import type { SessionData } from '@/auth/types';

export async function createSession(
  data: SessionData,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<string> {
  const token = randomUUID();
  const key = buildSessionKey(token);

  await redisClient.set(key, JSON.stringify(data), 'EX', SESSION_TTL_SECONDS);

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(sessions).values({
    userId: data.userId,
    token,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    expiresAt,
  });

  return token;
}

export async function getSession(token: string): Promise<SessionData | null> {
  const raw = await redisClient.get(buildSessionKey(token));
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function revokeSession(token: string): Promise<void> {
  await redisClient.del(buildSessionKey(token));
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.token, token));
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const activeSessions = await db.query.sessions.findMany({
    where: and(eq(sessions.userId, userId), isNull(sessions.revokedAt)),
    columns: { token: true },
  });

  for (const session of activeSessions) {
    await redisClient.del(buildSessionKey(session.token));
  }

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
