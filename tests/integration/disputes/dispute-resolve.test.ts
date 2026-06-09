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
import { brandWallets, payments } from '@/db/schema/index';

describe('dispute resolve', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  async function openDisputeOnSubmission() {
    const brand = await createKycApprovedBrand();
    const creator = await createKycApprovedCreator();
    const brandId = brand.user.brand!.id;
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

    for (const mutation of [
      {
        query: `mutation($type: OpportunityType!, $id: ID!) {
          submitOpportunityForApproval(type: $type, id: $id) { ... on UgcOrder { status } }
        }`,
        variables: { type: 'UGC_ORDER', id: orderId },
        sessionToken: brand.sessionToken,
      },
      {
        query: `mutation($input: ReviewOpportunityInput!) {
          reviewOpportunity(input: $input) { ... on UgcOrder { status } }
        }`,
        variables: {
          input: { type: 'UGC_ORDER', id: orderId, decision: 'approved' },
        },
        sessionToken: adminSession.sessionToken,
      },
    ]) {
      await executeGql(mutation.query, {
        sessionToken: mutation.sessionToken,
        variables: mutation.variables,
      });
    }

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

    const disputeResult = await executeGql<{ openDispute: { id: string } }>(
      `mutation($input: OpenDisputeInput!) {
        openDispute(input: $input) { id }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: {
          input: {
            referenceType: 'ugc_submission',
            referenceId: submissionId,
            subject: 'Refund requested',
            description: 'Does not meet requirements',
          },
        },
      },
    );

    return {
      brandId,
      submissionId,
      disputeId: disputeResult.data?.openDispute.id!,
    };
  }

  it(
    'brand_upheld refunds escrow to brand wallet',
    async () => {
      const { brandId, submissionId, disputeId } = await openDisputeOnSubmission();

      await executeGql(
        `mutation($input: ResolveDisputeInput!) {
          resolveDispute(input: $input) {
            status
            resolutionOutcome
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: {
            input: {
              disputeId,
              outcome: 'brand_upheld',
              resolution: 'Brand claim validated',
            },
          },
        },
      );

      const payment = await db.query.payments.findFirst({
        where: eq(payments.referenceId, submissionId),
      });
      expect(payment?.status).toBe('refunded');

      const brandWallet = await db.query.brandWallets.findFirst({
        where: eq(brandWallets.brandId, brandId),
      });
      expect(brandWallet?.reservedBalance).toBe('0.00');
      expect(brandWallet?.availableBalance).toBe('100000.00');
    },
    120_000,
  );

  it(
    'dismissed restores payment to in_escrow',
    async () => {
      const { submissionId, disputeId } = await openDisputeOnSubmission();

      await executeGql(
        `mutation($input: ResolveDisputeInput!) {
          resolveDispute(input: $input) { status resolutionOutcome }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: {
            input: {
              disputeId,
              outcome: 'dismissed',
              resolution: 'No merit found',
            },
          },
        },
      );

      const payment = await db.query.payments.findFirst({
        where: eq(payments.referenceId, submissionId),
      });
      expect(payment?.status).toBe('in_escrow');
    },
    120_000,
  );
});
