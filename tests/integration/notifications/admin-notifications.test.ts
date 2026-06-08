import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { executeGql } from '../../helpers/graphql';
import {
  createVerifiedBrand,
  createVerifiedCreator,
  defaultUgcOrderInput,
  ensureAdminSession,
} from '../../helpers/factories';
import { db } from '@/db/client';
import { notifications } from '@/db/schema/index';

describe('admin notifications', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it('notifies admins when KYC is submitted', async () => {
    const brand = await createVerifiedBrand();

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

    const adminNotifs = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, adminSession.user.id),
        eq(notifications.type, 'admin_kyc_pending_review'),
      ),
    });

    expect(adminNotifs.length).toBeGreaterThan(0);
    expect(adminNotifs[0]?.body).toContain('Test Brand Co');
  });

  it('notifies admins when campaign is submitted for approval', async () => {
    const { createKycApprovedBrand } = await import('../../helpers/factories');
    const brand = await createKycApprovedBrand();

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

    const adminNotifs = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, adminSession.user.id),
        eq(notifications.type, 'admin_campaign_pending_review'),
      ),
    });

    expect(adminNotifs.some((n) => n.referenceId === orderId)).toBe(true);
  });

  it('returns adminActionCounts for admin user', async () => {
    const result = await executeGql<{
      adminActionCounts: {
        pendingKyc: number;
        pendingCampaigns: number;
        openDisputes: number;
        unreadNotifications: number;
      };
    }>(
      `query {
        adminActionCounts {
          pendingKyc
          pendingCampaigns
          openDisputes
          unreadNotifications
        }
      }`,
      { sessionToken: adminSession.sessionToken },
    );

    expect(result.data?.adminActionCounts.pendingKyc).toBeGreaterThanOrEqual(0);
    expect(result.data?.adminActionCounts.unreadNotifications).toBeGreaterThanOrEqual(0);
  });

  it('creator can list notifications after KYC submit', async () => {
    const creator = await createVerifiedCreator();

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

    const result = await executeGql<{ myNotifications: { type: string }[] }>(
      `query { myNotifications { type title } }`,
      { sessionToken: creator.sessionToken },
    );

    expect(result.data?.myNotifications.some((n) => n.type === 'kyc_submitted')).toBe(true);
  });
});
