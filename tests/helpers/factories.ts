import { eq } from 'drizzle-orm';
import { registerBrand, registerCreator, verifyEmail, login } from '@/auth/auth.service';
import { db } from '@/db/client';
import { brandWallets } from '@/db/schema/index';
import { findEmailVerifyToken } from './redis';
import { executeGql } from './graphql';

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

export async function ensureAdminSession(): Promise<VerifiedUserResult> {
  try {
    return await createAdminSession();
  } catch {
    const { execSync } = await import('node:child_process');
    execSync('npx tsx src/scripts/seed-admin.ts', { stdio: 'inherit' });
    return createAdminSession();
  }
}

export async function createKycApprovedBrand(
  overrides: Partial<{ email: string; brandName: string; country: string; contactName: string }> = {},
): Promise<VerifiedUserResult> {
  const brand = await createVerifiedBrand(overrides);
  const admin = await ensureAdminSession();

  await executeGql(
    `mutation($input: SubmitKycInput!) {
      submitKyc(input: $input) { id }
    }`,
    {
      sessionToken: brand.sessionToken,
      variables: {
        input: {
          documents: [
            {
              documentType: 'business_registration',
              fileUrl: 'https://example.com/doc.pdf',
            },
          ],
        },
      },
    },
  );

  const appResult = await executeGql<{ myKycApplication: { id: string } }>(
    `query { myKycApplication { id } }`,
    { sessionToken: brand.sessionToken },
  );
  const applicationId = appResult.data?.myKycApplication?.id;
  if (!applicationId) throw new Error('Expected KYC application id');

  await executeGql(
    `mutation($input: ReviewKycInput!) {
      reviewKyc(input: $input) { status }
    }`,
    {
      sessionToken: admin.sessionToken,
      variables: {
        input: {
          applicationId,
          decision: 'approved',
        },
      },
    },
  );

  return brand;
}

export async function createKycApprovedCreator(
  overrides: Partial<{ email: string; fullName: string; school: string; country: string }> = {},
): Promise<VerifiedUserResult> {
  const creator = await createVerifiedCreator(overrides);
  const admin = await ensureAdminSession();

  await executeGql(
    `mutation($input: SubmitKycInput!) {
      submitKyc(input: $input) { id }
    }`,
    {
      sessionToken: creator.sessionToken,
      variables: {
        input: {
          documents: [
            {
              documentType: 'student_id',
              fileUrl: 'https://example.com/id.pdf',
            },
          ],
          schoolEmail: 'student@university.edu',
        },
      },
    },
  );

  const appResult = await executeGql<{ myKycApplication: { id: string } }>(
    `query { myKycApplication { id } }`,
    { sessionToken: creator.sessionToken },
  );
  const applicationId = appResult.data?.myKycApplication?.id;
  if (!applicationId) throw new Error('Expected KYC application id');

  await executeGql(
    `mutation($input: ReviewKycInput!) {
      reviewKyc(input: $input) { status }
    }`,
    {
      sessionToken: admin.sessionToken,
      variables: {
        input: {
          applicationId,
          decision: 'approved',
        },
      },
    },
  );

  return creator;
}

export async function fundBrandWallet(brandId: string, amount: string): Promise<void> {
  await db
    .update(brandWallets)
    .set({ availableBalance: amount, updatedAt: new Date() })
    .where(eq(brandWallets.brandId, brandId));
}

function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

export function defaultUgcOrderInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Summer UGC Campaign',
    productName: 'Test Product',
    shortDescription: 'Short brief for creators',
    fullDescription: 'Full creative brief with detailed instructions for creators.',
    videoType: 'ugc',
    videoLengthSeconds: 30,
    numberOfCreators: 5,
    flatRatePerCreator: '5000.00',
    currency: 'NGN',
    totalBudget: '25000.00',
    usageRightsPackage: 'basic',
    postingRequired: false,
    revisionLimit: 1,
    deadline: futureDate(30),
    referenceLinks: [{ url: 'https://example.com/reference', label: 'Example' }],
    ...overrides,
  };
}

export function defaultCpmDealInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'CPM Launch Campaign',
    productName: 'Test Product',
    shortDescription: 'CPM campaign brief',
    fullDescription: 'Creators post content and earn per 1000 views.',
    targetPlatform: 'tiktok',
    payPer1000Views: '500.00',
    maxPayableViewsPerCreator: 100000,
    numberOfCreators: 10,
    maxCampaignBudget: '50000.00',
    currency: 'NGN',
    usageRightsPackage: 'ad',
    postingDeadline: futureDate(14),
    finalViewCountDeadline: futureDate(45),
    referenceLinks: [{ url: 'https://example.com/cpm-ref' }],
    ...overrides,
  };
}

export function defaultContestInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Brand Challenge Contest',
    productName: 'Test Product',
    shortDescription: 'Contest brief',
    fullDescription: 'Create the best video to win prizes.',
    targetPlatform: 'instagram',
    usageRightsPackage: 'full',
    totalContestBudget: '100000.00',
    currency: 'NGN',
    minimumWinners: 3,
    submissionDeadline: futureDate(21),
    winnerAnnouncementDate: futureDate(30),
    referenceLinks: [
      { url: 'https://example.com/inspo', label: 'Inspiration', isInspiration: true },
    ],
    rewards: [
      { placement: 1, label: 'First place', amount: '50000.00', currency: 'NGN' },
      { placement: 2, label: 'Second place', amount: '30000.00', currency: 'NGN' },
      { placement: 3, label: 'Third place', amount: '20000.00', currency: 'NGN' },
    ],
    ...overrides,
  };
}
