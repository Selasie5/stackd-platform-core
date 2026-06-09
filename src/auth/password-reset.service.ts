import { randomInt } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema/index';
import {
  buildPasswordResetOtpKey,
  PASSWORD_RESET_OTP_MAX_ATTEMPTS,
  PASSWORD_RESET_OTP_TTL_SECONDS,
} from '@/auth/constants';
import { authError } from '@/auth/errors';
import { hashPassword, verifyPassword } from '@/auth/password';
import { revokeAllSessionsForUser } from '@/auth/session.service';
import { redisClient } from '@/queues/client';
import { sendPasswordResetOtpEmail } from '@/services/email/index';
import { config } from '@/config/index';

interface PasswordResetOtpRecord {
  userId: string;
  otpHash: string;
  attempts: number;
  createdAt: string;
}

const testOtpStore = new Map<string, string>();

const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8),
});

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export function getPasswordResetOtpForTest(email: string): string | undefined {
  if (config.NODE_ENV !== 'test') return undefined;
  return testOtpStore.get(email.toLowerCase());
}

export async function requestPasswordReset(email: string): Promise<boolean> {
  const normalized = email.toLowerCase();
  const rateLimitKey = `password_reset_request:${normalized}`;
  const count = await redisClient.incr(rateLimitKey);
  if (count === 1) {
    await redisClient.expire(rateLimitKey, 3600);
  }
  if (count > 3) {
    throw authError('RATE_LIMITED', 'Too many requests. Please try again later.');
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, normalized), isNull(users.deletedAt)),
  });

  if (!user || !user.emailVerified || user.status === 'banned') {
    return true;
  }

  const otp = generateOtp();
  const otpHash = await hashPassword(otp);
  const record: PasswordResetOtpRecord = {
    userId: user.id,
    otpHash,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  await redisClient.set(
    buildPasswordResetOtpKey(normalized),
    JSON.stringify(record),
    'EX',
    PASSWORD_RESET_OTP_TTL_SECONDS,
  );

  if (config.NODE_ENV === 'test') {
    testOtpStore.set(normalized, otp);
  }

  await sendPasswordResetOtpEmail(normalized, otp);
  return true;
}

export async function resetPassword(input: unknown): Promise<boolean> {
  const data = resetPasswordSchema.parse(input);
  const normalized = data.email.toLowerCase();
  const raw = await redisClient.get(buildPasswordResetOtpKey(normalized));

  if (!raw) {
    throw authError('INVALID_OTP', 'Invalid or expired verification code');
  }

  const record = JSON.parse(raw) as PasswordResetOtpRecord;

  if (record.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
    await redisClient.del(buildPasswordResetOtpKey(normalized));
    throw authError('OTP_ATTEMPTS_EXCEEDED', 'Too many failed attempts. Request a new code.');
  }

  const otpValid = await verifyPassword(data.otp, record.otpHash);
  if (!otpValid) {
    record.attempts += 1;
    const ttl = await redisClient.ttl(buildPasswordResetOtpKey(normalized));
    if (ttl > 0) {
      await redisClient.set(
        buildPasswordResetOtpKey(normalized),
        JSON.stringify(record),
        'EX',
        ttl,
      );
    }

    if (record.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
      await redisClient.del(buildPasswordResetOtpKey(normalized));
      throw authError('OTP_ATTEMPTS_EXCEEDED', 'Too many failed attempts. Request a new code.');
    }

    throw authError('INVALID_OTP', 'Invalid or expired verification code');
  }

  const passwordHash = await hashPassword(data.newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, record.userId));

  await revokeAllSessionsForUser(record.userId);
  await redisClient.del(buildPasswordResetOtpKey(normalized));
  testOtpStore.delete(normalized);

  return true;
}
