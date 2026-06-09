import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  createKycApprovedCreator,
  defaultUgcOrderInput,
  ensureAdminSession,
  fundBrandWallet,
} from '../../helpers/factories';
import { db } from '@/db/client';
import { brandWallets, creatorWallets, payments } from '@/db/schema/index';

describe('dispute escrow block', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  async function setupApprovedEscrow() {
    const brand = await createKycApprovedBrand();
    const creator = await createKycApprovedCreator();
    const brandId = brand.user.brand!.id;
    const creatorId = creator.user.creator!.id;
    await fundBrandWallet(brandId, '100000.00');

    const createResult = await executeGql<{ createUgcOrder: { id: string } }>(
      `mutation($input: CreateUgcOrderInput!) {
        createUgcOrder(input: $input) { id }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: {
          input: defaultUgcOrderInput({
            numberOfCreators: 1,
            flatRatePerCreator: '5000.00',
            totalBudget: '5000.00',
          }),
        },
      },
    );
    const orderId = createResult.data?.createUgcOrder.id;
    if (!orderId) throw new Error('Expected order id');

    await executeGql(
      `mutation($type: OpportunityType!, $id: ID!) {
        submitOpportunityForApproval(type: $type, id: $id) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'UGC_ORDER', id: orderId },
      },
    );

    await executeGql(
      `mutation($input: ReviewOpportunityInput!) {
        reviewOpportunity(input: $input) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: { type: 'UGC_ORDER', id: orderId, decision: 'approved' },
        },
      },
    );

    const submitResult = await executeGql<{ submitUgcSubmission: { id: string } }>(
      `mutation($input: SubmitUgcSubmissionInput!) {
        submitUgcSubmission(input: $input) { id }
      }`,
      {
        sessionToken: creator.sessionToken,
        variables: {
          input: {
            ugcOrderId: orderId,
            videoUrl: 'https://example.com/video.mp4',
            watermarkedPreviewUrl: 'https://example.com/preview.mp4',
          },
        },
      },
    );
    const submissionId = submitResult.data?.submitUgcSubmission.id;
    if (!submissionId) throw new Error('Expected submission id');

    await executeGql(
      `mutation($submissionId: ID!) {
        approveUgcSubmission(submissionId: $submissionId) { status }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { submissionId },
      },
    );

    return { brand, creator, brandId, creatorId, orderId, submissionId };
  }

  it(
    'blocks escrow release when payment is disputed',
    async () => {
      const { brand, brandId, creatorId, orderId, submissionId } = await setupApprovedEscrow();

      await executeGql(
        `mutation($input: OpenDisputeInput!) {
          openDispute(input: $input) { id status }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: {
            input: {
              referenceType: 'ugc_submission',
              referenceId: submissionId,
              subject: 'Quality issue',
              description: 'Video does not match brief',
            },
          },
        },
      );

      const disputedPayment = await db.query.payments.findFirst({
        where: eq(payments.referenceId, submissionId),
      });
      expect(disputedPayment?.status).toBe('disputed');

      await executeGql(
        `mutation($type: OpportunityType!, $id: ID!) {
          completeOpportunity(type: $type, id: $id) { ... on UgcOrder { status } }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: { type: 'UGC_ORDER', id: orderId },
        },
      );

      const creatorWallet = await db.query.creatorWallets.findFirst({
        where: eq(creatorWallets.creatorId, creatorId),
      });
      expect(creatorWallet?.availableBalance).toBe('0.00');

      const paymentAfterComplete = await db.query.payments.findFirst({
        where: eq(payments.referenceId, submissionId),
      });
      expect(paymentAfterComplete?.status).toBe('disputed');

      const brandWallet = await db.query.brandWallets.findFirst({
        where: eq(brandWallets.brandId, brandId),
      });
      expect(brandWallet?.reservedBalance).toBe('5000.00');
    },
    120_000,
  );
});
