import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  createKycApprovedCreator,
  defaultUgcOrderInput,
  ensureAdminSession,
  fundBrandWallet,
} from '../../helpers/factories';

describe('message flow', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'brand and creator can exchange messages on an order thread',
    async () => {
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
          variables: { input: defaultUgcOrderInput() },
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

      await executeGql(
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

      const brandUserId = brand.user.id;
      const creatorUserId = creator.user.id;

      await executeGql(
        `mutation($input: SendMessageInput!) {
          sendMessage(input: $input) { id body senderId recipientId }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: {
            input: {
              recipientId: creatorUserId,
              body: 'Thanks for submitting!',
              referenceType: 'ugc_order',
              referenceId: orderId,
            },
          },
        },
      );

      await executeGql(
        `mutation($input: SendMessageInput!) {
          sendMessage(input: $input) { id body }
        }`,
        {
          sessionToken: creator.sessionToken,
          variables: {
            input: {
              recipientId: brandUserId,
              body: 'Happy to help!',
              referenceType: 'ugc_order',
              referenceId: orderId,
            },
          },
        },
      );

      const conversation = await executeGql<{
        conversation: { body: string; senderId: string }[];
      }>(
        `query($referenceType: MessageReferenceType!, $referenceId: ID!) {
          conversation(referenceType: $referenceType, referenceId: $referenceId) {
            body
            senderId
            isRead
          }
        }`,
        {
          sessionToken: creator.sessionToken,
          variables: { referenceType: 'ugc_order', referenceId: orderId },
        },
      );

      expect(conversation.data?.conversation.length).toBe(2);
      expect(conversation.data?.conversation.some((m) => m.body === 'Happy to help!')).toBe(true);

      const markRead = await executeGql<{ markMessagesRead: number }>(
        `mutation($referenceType: MessageReferenceType!, $referenceId: ID!) {
          markMessagesRead(referenceType: $referenceType, referenceId: $referenceId)
        }`,
        {
          sessionToken: creator.sessionToken,
          variables: { referenceType: 'ugc_order', referenceId: orderId },
        },
      );
      expect(markRead.data?.markMessagesRead).toBeGreaterThan(0);

      const notifications = await executeGql<{ myNotifications: { type: string }[] }>(
        `query { myNotifications { type } }`,
        { sessionToken: creator.sessionToken },
      );
      expect(notifications.data?.myNotifications.some((n) => n.type === 'message_received')).toBe(
        true,
      );
    },
    120_000,
  );
});
