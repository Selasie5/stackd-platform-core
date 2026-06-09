import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  ensureAdminSession,
  fundBrandWallet,
} from '../../helpers/factories';

describe('admin wallet ops', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'freezes brand wallet and blocks top-up',
    async () => {
      const brand = await createKycApprovedBrand();
      const brandId = brand.user.brand!.id;
      await fundBrandWallet(brandId, '50000.00');

      const freezeResult = await executeGql<{
        freezeWallet: { wallet: { status: string } };
      }>(
        `mutation($input: FreezeWalletInput!) {
          freezeWallet(input: $input) {
            ... on AdminBrandWalletDetail {
              wallet { status }
            }
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: {
            input: {
              profileType: 'brand',
              profileId: brandId,
              reason: 'Compliance review',
            },
          },
        },
      );

      expect(freezeResult.errors).toBeUndefined();
      expect(freezeResult.data?.freezeWallet.wallet.status).toBe('frozen');

      const topUpResult = await executeGql(
        `mutation($amount: String!) {
          initializeWalletTopUp(amount: $amount) { topUpId }
        }`,
        {
          sessionToken: brand.sessionToken,
          variables: { amount: '1000.00' },
        },
      );
      expect(topUpResult.errors?.length).toBeGreaterThan(0);

      const unfreezeResult = await executeGql<{
        unfreezeWallet: { wallet: { status: string } };
      }>(
        `mutation($input: FreezeWalletInput!) {
          unfreezeWallet(input: $input) {
            ... on AdminBrandWalletDetail {
              wallet { status }
            }
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: {
            input: {
              profileType: 'brand',
              profileId: brandId,
              reason: 'Review complete',
            },
          },
        },
      );

      expect(unfreezeResult.data?.unfreezeWallet.wallet.status).toBe('active');
    },
    120_000,
  );

  it(
    'returns admin brand wallet with transactions',
    async () => {
      const brand = await createKycApprovedBrand();
      const brandId = brand.user.brand!.id;
      await fundBrandWallet(brandId, '10000.00');

      const result = await executeGql<{
        adminBrandWallet: {
          brandName: string;
          wallet: { availableBalance: string };
          transactions: { id: string }[];
        };
      }>(
        `query($brandId: ID!) {
          adminBrandWallet(brandId: $brandId) {
            brandName
            wallet { availableBalance }
            transactions { id }
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { brandId },
        },
      );

      expect(result.errors).toBeUndefined();
      expect(Number(result.data?.adminBrandWallet.wallet.availableBalance)).toBe(10000);
      expect(result.data?.adminBrandWallet.transactions).toBeDefined();
    },
    60_000,
  );
});
