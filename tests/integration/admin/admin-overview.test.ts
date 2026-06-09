import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import { ensureAdminSession } from '../../helpers/factories';

describe('admin overview', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'returns expanded adminOverview counts',
    async () => {
      const result = await executeGql<{
        adminOverview: {
          pendingKyc: number;
          pendingCampaigns: number;
          openDisputes: number;
          unreadNotifications: number;
          needsMoreInfoKyc: number;
          disputedPayments: number;
          failedWithdrawals: number;
          processingWithdrawals: number;
        };
        adminActionCounts: {
          pendingKyc: number;
          pendingCampaigns: number;
          openDisputes: number;
          unreadNotifications: number;
        };
      }>(
        `query {
          adminOverview {
            pendingKyc
            pendingCampaigns
            openDisputes
            unreadNotifications
            needsMoreInfoKyc
            disputedPayments
            failedWithdrawals
            processingWithdrawals
          }
          adminActionCounts {
            pendingKyc
            pendingCampaigns
            openDisputes
            unreadNotifications
          }
        }`,
        { sessionToken: adminSession.sessionToken },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.adminOverview.pendingKyc).toBeGreaterThanOrEqual(0);
      expect(result.data?.adminOverview.needsMoreInfoKyc).toBeGreaterThanOrEqual(0);
      expect(result.data?.adminOverview.disputedPayments).toBeGreaterThanOrEqual(0);
      expect(result.data?.adminOverview.failedWithdrawals).toBeGreaterThanOrEqual(0);
      expect(result.data?.adminOverview.processingWithdrawals).toBeGreaterThanOrEqual(0);
      expect(result.data?.adminActionCounts.pendingKyc).toBe(
        result.data?.adminOverview.pendingKyc,
      );
    },
    60_000,
  );
});
