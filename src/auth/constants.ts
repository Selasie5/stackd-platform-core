import { config } from '@/config/index';

export const SESSION_COOKIE_NAME = config.SESSION_COOKIE_NAME;
export const SESSION_TTL_SECONDS = config.SESSION_TTL_SECONDS;
export const SESSION_REDIS_PREFIX = config.SESSION_REDIS_PREFIX;
export const EMAIL_VERIFY_TTL_SECONDS = config.EMAIL_VERIFY_TTL_SECONDS;
export const EMAIL_VERIFY_REDIS_PREFIX = config.EMAIL_VERIFY_REDIS_PREFIX;

export function buildSessionKey(token: string): string {
  return `${SESSION_REDIS_PREFIX}${token}`;
}

export function buildEmailVerifyKey(token: string): string {
  return `${EMAIL_VERIFY_REDIS_PREFIX}${token}`;
}
