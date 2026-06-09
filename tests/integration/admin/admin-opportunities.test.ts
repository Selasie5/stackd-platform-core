import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  defaultUgcOrderInput,
  ensureAdminSession,
  fundBrandWallet,
} from '../../helpers/factories';

describe('admin opportunities', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'lists live opportunities after approval and notifies brand on reject',
    async () => {
      const brand = await createKycApprovedBrand({ brandName: 'Opp Reject Brand' });
      await fundBrandWallet(brand.user.brand!.id, '100000.00');

      const createResult = await executeGql<{ createUgcOrder: { id: string } }>(
        `mutation($input: CreateUgcOrderInput!) {
          createUgcOrder(input: $input) { id }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: { input: defaultUgcOrderInput({ title: 'Admin Ops Campaign' }) },
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

      const liveResult = await executeGql<{
        adminOpportunities: { id: string; status: string; title: string }[];
      }>(
        `query {
          adminOpportunities(type: UGC_ORDER, status: live) {
            id
            status
            title
          }
        }`,
        { sessionToken: adminSession.sessionToken },
      );

      expect(liveResult.errors).toBeUndefined();
      expect(liveResult.data?.adminOpportunities.some((o) => o.id === orderId)).toBe(true);

      const rejectBrand = await createKycApprovedBrand();
      await fundBrandWallet(rejectBrand.user.brand!.id, '100000.00');
      const rejectCreate = await executeGql<{ createUgcOrder: { id: string } }>(
        `mutation($input: CreateUgcOrderInput!) {
          createUgcOrder(input: $input) { id }
        }`,
        {
          sessionToken: rejectBrand.sessionToken,
          variables: { input: defaultUgcOrderInput({ title: 'Reject Me Campaign' }) },
        },
      );
      const rejectOrderId = rejectCreate.data?.createUgcOrder.id;
      if (!rejectOrderId) throw new Error('Expected reject order id');

      await executeGql(
        `mutation($type: OpportunityType!, $id: ID!) {
          submitOpportunityForApproval(type: $type, id: $id) { ... on UgcOrder { status } }
        }`,
        {
          sessionToken: rejectBrand.sessionToken,
          variables: { type: 'UGC_ORDER', id: rejectOrderId },
        },
      );

      await executeGql(
        `mutation($input: ReviewOpportunityInput!) {
          reviewOpportunity(input: $input) { ... on UgcOrder { status } }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: {
            input: {
              type: 'UGC_ORDER',
              id: rejectOrderId,
              decision: 'rejected',
              adminNote: 'Budget unclear',
            },
          },
        },
      );

      const notifs = await executeGql<{ myNotifications: { type: string; body: string }[] }>(
        `query { myNotifications { type body } }`,
        { sessionToken: rejectBrand.sessionToken },
      );
      expect(
        notifs.data?.myNotifications.some(
          (n) => n.type === 'campaign_rejected' && n.body.includes('Budget unclear'),
        ),
      ).toBe(true);
    },
    120_000,
  );
});
