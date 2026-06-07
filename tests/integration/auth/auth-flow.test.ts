import { describe, it, expect } from 'vitest';
import { executeGql, expectGqlError } from '../../helpers/graphql';
import { findEmailVerifyToken } from '../../helpers/redis';
import { registerBrand, verifyEmail, login } from '@/auth/auth.service';
import { getSession } from '@/auth/session.service';
import { createVerifiedBrand } from '../../helpers/factories';

describe('auth flow', () => {
  it('registers, blocks login before verify, verifies, logs in, logs out', async () => {
    const email = `auth-test-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    await registerBrand({
      email,
      password,
      brandName: 'Auth Test Brand',
      country: 'Nigeria',
      contactName: 'Test User',
    });

    await expect(login({ email, password })).rejects.toMatchObject({
      extensions: { code: 'EMAIL_NOT_VERIFIED' },
    });

    const verifyToken = await findEmailVerifyToken(email);
    expect(verifyToken).toBeTruthy();

    const { user: verifiedUser, token: verifySessionToken } = await verifyEmail(verifyToken!);
    expect(verifiedUser.emailVerified).toBe(true);

    const meAfterVerify = await executeGql<{ me: { email: string } }>(
      `query { me { email } }`,
      { sessionToken: verifySessionToken },
    );
    expect(meAfterVerify.data?.me.email).toBe(email);

    const logoutResult = await executeGql<{ logout: boolean }>(`mutation { logout }`, {
      sessionToken: verifySessionToken,
    });
    expect(logoutResult.data?.logout).toBe(true);

    const meAfterLogout = await executeGql(`query { me { email } }`, {
      sessionToken: verifySessionToken,
    });
    expectGqlError(meAfterLogout, 'UNAUTHENTICATED');

    const { token: loginToken } = await login({ email, password });
    const session = await getSession(loginToken);
    expect(session?.email).toBe(email);

    const brand = await createVerifiedBrand();
    const meResult = await executeGql<{ me: { brand: { brandName: string } } }>(
      `query { me { brand { brandName } } }`,
      { sessionToken: brand.sessionToken },
    );
    expect(meResult.data?.me.brand?.brandName).toBeTruthy();
  });
});
