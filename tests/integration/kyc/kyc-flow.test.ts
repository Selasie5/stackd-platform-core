import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { executeGql, expectGqlError } from '../../helpers/graphql';
import { createVerifiedBrand, createVerifiedCreator, createAdminSession } from '../../helpers/factories';
import { db } from '@/db/client';
import { brandWallets, brands } from '@/db/schema/index';

async function getMyKycApplicationId(sessionToken: string): Promise<string> {
  const result = await executeGql<{ myKycApplication: { id: string } }>(
    `query { myKycApplication { id } }`,
    { sessionToken },
  );
  const id = result.data?.myKycApplication?.id;
  if (!id) throw new Error('Expected myKycApplication id');
  return id;
}

describe('kyc flow', () => {
  let adminSession: Awaited<ReturnType<typeof createAdminSession>>;

  beforeAll(async () => {
    try {
      adminSession = await createAdminSession();
    } catch {
      const { execSync } = await import('node:child_process');
      execSync('npx tsx src/scripts/seed-admin.ts', { stdio: 'inherit' });
      adminSession = await createAdminSession();
    }
  });

  it('brand kyc: submit, block duplicate, reject, resubmit, approve, unfreeze wallet', async () => {
    const brand = await createVerifiedBrand();

    const walletBefore = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brand.user.brand!.id),
    });
    expect(walletBefore?.status).toBe('frozen');

    const submitResult = await executeGql<{ submitKyc: { status: string; attemptNumber: number } }>(
      `mutation($input: SubmitKycInput!) {
        submitKyc(input: $input) { status attemptNumber }
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
    expect(submitResult.data?.submitKyc.status).toBe('pending_review');
    expect(submitResult.data?.submitKyc.attemptNumber).toBe(1);

    const duplicateSubmit = await executeGql(
      `mutation($input: SubmitKycInput!) {
        submitKyc(input: $input) { id }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: {
          input: {
            documents: [{ documentType: 'business_registration', fileUrl: 'https://example.com/doc2.pdf' }],
          },
        },
      },
    );
    expectGqlError(duplicateSubmit, 'KYC_ALREADY_PENDING');

    const applicationId = await getMyKycApplicationId(brand.sessionToken);

    const rejectResult = await executeGql<{ reviewKyc: { status: string } }>(
      `mutation($input: ReviewKycInput!) {
        reviewKyc(input: $input) { status }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: {
            applicationId,
            decision: 'rejected',
            rejectionReason: 'Document unclear',
          },
        },
      },
    );
    expect(rejectResult.data?.reviewKyc.status).toBe('rejected');

    const resubmitResult = await executeGql<{ submitKyc: { attemptNumber: number } }>(
      `mutation($input: SubmitKycInput!) {
        submitKyc(input: $input) { status attemptNumber }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: {
          input: {
            documents: [{ documentType: 'business_registration', fileUrl: 'https://example.com/doc-v2.pdf' }],
          },
        },
      },
    );
    expect(resubmitResult.data?.submitKyc.attemptNumber).toBe(2);

    const applicationId2 = await getMyKycApplicationId(brand.sessionToken);

    const approveResult = await executeGql<{ reviewKyc: { status: string } }>(
      `mutation($input: ReviewKycInput!) {
        reviewKyc(input: $input) { status }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: { applicationId: applicationId2, decision: 'approved' },
        },
      },
    );
    expect(approveResult.data?.reviewKyc.status).toBe('approved');

    const walletAfter = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brand.user.brand!.id),
    });
    expect(walletAfter?.status).toBe('active');

    const brandProfile = await db.query.brands.findFirst({
      where: eq(brands.id, brand.user.brand!.id),
    });
    expect(brandProfile?.kycStatus).toBe('approved');
  });

  it('creator kyc: submit and approve', async () => {
    const creator = await createVerifiedCreator();

    const submitResult = await executeGql<{ submitKyc: { status: string } }>(
      `mutation($input: SubmitKycInput!) {
        submitKyc(input: $input) { status }
      }`,
      {
        sessionToken: creator.sessionToken,
        variables: {
          input: {
            documents: [{ documentType: 'student_id', fileUrl: 'https://example.com/id.pdf' }],
            schoolEmail: 'student@university.edu',
          },
        },
      },
    );
    expect(submitResult.data?.submitKyc.status).toBe('pending_review');

    const appId = await getMyKycApplicationId(creator.sessionToken);

    const approveResult = await executeGql<{ reviewKyc: { status: string } }>(
      `mutation($input: ReviewKycInput!) {
        reviewKyc(input: $input) { status }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: { input: { applicationId: appId, decision: 'approved' } },
      },
    );
    expect(approveResult.data?.reviewKyc.status).toBe('approved');
  });

  it('non-admin cannot review kyc', async () => {
    const brand = await createVerifiedBrand();
    const forbidden = await executeGql(
      `mutation($input: ReviewKycInput!) {
        reviewKyc(input: $input) { id }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: {
          input: { applicationId: '00000000-0000-0000-0000-000000000001', decision: 'approved' },
        },
      },
    );
    expectGqlError(forbidden, 'FORBIDDEN');
  });
});
