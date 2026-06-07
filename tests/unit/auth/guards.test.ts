import { describe, it, expect } from 'vitest';
import { requireAuth, requireRole, requireEmailVerified } from '@/auth/guards';
import { createMockContext } from '../../helpers/context';
import type { SessionData } from '@/auth/types';

const baseSession: SessionData = {
  userId: 'user-1',
  role: 'brand',
  email: 'brand@test.com',
  emailVerified: true,
  brandId: 'brand-1',
};

describe('auth guards', () => {
  it('requireAuth throws UNAUTHENTICATED when no session', () => {
    const ctx = createMockContext(null);
    expect(() => requireAuth(ctx)).toThrowError(
      expect.objectContaining({ extensions: { code: 'UNAUTHENTICATED' } }),
    );
  });

  it('requireAuth returns session when present', () => {
    const ctx = createMockContext(baseSession);
    expect(requireAuth(ctx)).toEqual(baseSession);
  });

  it('requireRole throws FORBIDDEN for wrong role', () => {
    const ctx = createMockContext(baseSession);
    expect(() => requireRole(ctx, ['admin'])).toThrowError(
      expect.objectContaining({ extensions: { code: 'FORBIDDEN' } }),
    );
  });

  it('requireRole passes for allowed role', () => {
    const ctx = createMockContext(baseSession);
    expect(requireRole(ctx, ['brand'])).toEqual(baseSession);
  });

  it('requireEmailVerified throws when email not verified', () => {
    const ctx = createMockContext({ ...baseSession, emailVerified: false });
    expect(() => requireEmailVerified(ctx)).toThrowError(
      expect.objectContaining({ extensions: { code: 'EMAIL_NOT_VERIFIED' } }),
    );
  });
});
