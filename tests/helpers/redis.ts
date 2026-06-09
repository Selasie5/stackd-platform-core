import { redisClient } from '@/queues/client';
import { EMAIL_VERIFY_REDIS_PREFIX } from '@/auth/constants';

export async function findEmailVerifyToken(email: string): Promise<string | null> {
  const keys = await redisClient.keys(`${EMAIL_VERIFY_REDIS_PREFIX}*`);
  for (const key of keys) {
    const raw = await redisClient.get(key);
    if (raw && raw.includes(email)) {
      return key.replace(EMAIL_VERIFY_REDIS_PREFIX, '');
    }
  }
  return null;
}

export async function flushTestRedisKeys(): Promise<void> {
  const patterns = [
    'email_verify:*',
    'resend_verify:*',
    'password_reset_request:*',
    'password_reset_otp:*',
    'session:*',
  ];
  for (const pattern of patterns) {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  }
}
