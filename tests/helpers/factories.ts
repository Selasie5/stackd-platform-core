import { registerBrand, registerCreator, verifyEmail, login } from '@/auth/auth.service';
import { findEmailVerifyToken } from './redis';

const PASSWORD = 'TestPass123!';

export interface VerifiedUserResult {
  email: string;
  password: string;
  user: Awaited<ReturnType<typeof verifyEmail>>['user'];
  sessionToken: string;
}

export async function createVerifiedBrand(
  overrides: Partial<{ email: string; brandName: string; country: string; contactName: string }> = {},
): Promise<VerifiedUserResult> {
  const email = overrides.email ?? `test-brand-${Date.now()}@example.com`;

  await registerBrand({
    email,
    password: PASSWORD,
    brandName: overrides.brandName ?? 'Test Brand Co',
    country: overrides.country ?? 'Nigeria',
    contactName: overrides.contactName ?? 'Jane Doe',
  });

  const token = await findEmailVerifyToken(email);
  if (!token) throw new Error(`No verification token for ${email}`);

  const { user, token: sessionToken } = await verifyEmail(token);
  return { email, password: PASSWORD, user, sessionToken };
}

export async function createVerifiedCreator(
  overrides: Partial<{ email: string; fullName: string; school: string; country: string }> = {},
): Promise<VerifiedUserResult> {
  const email = overrides.email ?? `test-creator-${Date.now()}@example.com`;

  await registerCreator({
    email,
    password: PASSWORD,
    fullName: overrides.fullName ?? 'Test Creator',
    country: overrides.country ?? 'Nigeria',
    school: overrides.school ?? 'Test University',
  });

  const token = await findEmailVerifyToken(email);
  if (!token) throw new Error(`No verification token for ${email}`);

  const { user, token: sessionToken } = await verifyEmail(token);
  return { email, password: PASSWORD, user, sessionToken };
}

export async function createAdminSession(
  email = 'admin@spleenet.com',
  password = 'AdminPass123!',
): Promise<VerifiedUserResult> {
  const result = await login({ email, password });
  return {
    email,
    password,
    user: result.user,
    sessionToken: result.token,
  };
}
