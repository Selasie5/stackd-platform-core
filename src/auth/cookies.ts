import type { Response } from 'express';
import { config } from '@/config/index';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/auth/constants';

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: SESSION_TTL_SECONDS * 1000,
    domain: config.COOKIE_DOMAIN,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: config.COOKIE_DOMAIN,
    path: '/',
  });
}
