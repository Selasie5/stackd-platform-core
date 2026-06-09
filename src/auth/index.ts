export type { SessionData, UserRole, EmailVerificationPayload } from '@/auth/types';
export {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SESSION_REDIS_PREFIX,
  EMAIL_VERIFY_TTL_SECONDS,
  EMAIL_VERIFY_REDIS_PREFIX,
  PASSWORD_RESET_OTP_TTL_SECONDS,
  PASSWORD_RESET_OTP_REDIS_PREFIX,
  PASSWORD_RESET_OTP_MAX_ATTEMPTS,
  buildSessionKey,
  buildEmailVerifyKey,
  buildPasswordResetOtpKey,
} from '@/auth/constants';
export { hashPassword, verifyPassword } from '@/auth/password';
export { setSessionCookie, clearSessionCookie } from '@/auth/cookies';
export {
  createSession,
  getSession,
  revokeSession,
  revokeAllSessionsForUser,
} from '@/auth/session.service';
export {
  requestPasswordReset,
  resetPassword,
  getPasswordResetOtpForTest,
} from '@/auth/password-reset.service';
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
