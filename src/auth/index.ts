export type { SessionData, UserRole, EmailVerificationPayload } from '@/auth/types';
export {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SESSION_REDIS_PREFIX,
  EMAIL_VERIFY_TTL_SECONDS,
  EMAIL_VERIFY_REDIS_PREFIX,
  buildSessionKey,
  buildEmailVerifyKey,
} from '@/auth/constants';
export { hashPassword, verifyPassword } from '@/auth/password';
export { setSessionCookie, clearSessionCookie } from '@/auth/cookies';
export { createSession, getSession, revokeSession } from '@/auth/session.service';
export {
  registerBrand,
  registerCreator,
  login,
  logout,
  verifyEmail,
  resendVerificationEmail,
  getMe,
  formatUser,
} from '@/auth/auth.service';
export { requireAuth, requireRole, requireEmailVerified } from '@/auth/guards';
export { authError } from '@/auth/errors';
