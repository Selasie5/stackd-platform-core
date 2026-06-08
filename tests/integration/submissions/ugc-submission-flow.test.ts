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
import {
  brandWallets,
  creatorWallets,
  payments,
  ugcSubmissions,
} from '@/db/schema/index';

describe('ugc submission flow', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'submit, revise, resubmit, approve, escrow on complete',
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

      const submitResult = await executeGql<{ submitUgcSubmission: { id: string; status: string } }>(
        `mutation($input: SubmitUgcSubmissionInput!) {
          submitUgcSubmission(input: $input) { id status }
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
      expect(submitResult.data?.submitUgcSubmission.status).toBe('submitted');
      if (!submissionId) throw new Error('Expected submission id');

      await executeGql(
        `mutation($submissionId: ID!, $revisionNote: String!) {
          requestUgcRevision(submissionId: $submissionId, revisionNote: $revisionNote) {
            status revisionNumber
          }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: { submissionId, revisionNote: 'Please fix lighting' },
        },
      );

      const resubmitResult = await executeGql<{ resubmitUgcSubmission: { status: string } }>(
        `mutation($input: ResubmitUgcSubmissionInput!) {
          resubmitUgcSubmission(input: $input) { status }
        }`,
        {
          sessionToken: creator.sessionToken,
          variables: {
            input: {
              submissionId,
              videoUrl: 'https://example.com/video-v2.mp4',
            },
          },
        },
      );
      expect(resubmitResult.data?.resubmitUgcSubmission.status).toBe('resubmitted');

      await executeGql(
        `mutation($submissionId: ID!) {
          approveUgcSubmission(submissionId: $submissionId) { status }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: { submissionId },
        },
      );

      const escrowPayment = await db.query.payments.findFirst({
        where: eq(payments.referenceId, submissionId),
      });
      expect(escrowPayment?.status).toBe('in_escrow');
      expect(escrowPayment?.amount).toBe('5000.00');

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
      expect(brandWallet?.totalSpent).toBe('5000.00');

      const updatedPayment = await db.query.payments.findFirst({
        where: eq(payments.referenceId, submissionId),
      });
      expect(updatedPayment?.status).toBe('ready_for_payout');

      const submission = await db.query.ugcSubmissions.findFirst({
        where: eq(ugcSubmissions.id, submissionId),
      });
      expect(submission?.status).toBe('approved');
    },
    120_000,
  );
});
