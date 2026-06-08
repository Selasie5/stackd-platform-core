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

describe('escrow release', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'releases approved escrow to creator and returns unused reserved budget to brand',
    async () => {
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
              numberOfCreators: 2,
              flatRatePerCreator: '5000.00',
              totalBudget: '10000.00',
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

      const walletAfterReserve = await db.query.brandWallets.findFirst({
        where: eq(brandWallets.brandId, brandId),
      });
      expect(walletAfterReserve?.availableBalance).toBe('90000.00');
      expect(walletAfterReserve?.reservedBalance).toBe('10000.00');

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

      await executeGql(
        `mutation($type: OpportunityType!, $id: ID!) {
          closeOpportunity(type: $type, id: $id) { ... on UgcOrder { status } }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: { type: 'UGC_ORDER', id: orderId },
        },
      );

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
      expect(creatorWallet?.availableBalance).toBe('5000.00');

      const brandWallet = await db.query.brandWallets.findFirst({
        where: eq(brandWallets.brandId, brandId),
      });
      expect(brandWallet?.reservedBalance).toBe('0.00');
      expect(brandWallet?.availableBalance).toBe('95000.00');
      expect(brandWallet?.totalSpent).toBe('5000.00');

      const escrowRows = await db.query.payments.findMany({
        where: eq(payments.opportunityId, orderId),
      });
      expect(escrowRows).toHaveLength(1);
      expect(escrowRows[0]?.status).toBe('ready_for_payout');
      expect(escrowRows[0]?.amount).toBe('5000.00');
    },
    120_000,
  );
});
