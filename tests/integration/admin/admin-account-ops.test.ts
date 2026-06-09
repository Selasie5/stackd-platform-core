import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  createKycApprovedCreator,
  ensureAdminSession,
  fundBrandWallet,
  fundCreatorWallet,
} from '../../helpers/factories';
import { login } from '@/auth/auth.service';

describe('admin account ops', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'suspendBrand blocks login and wallet top-up; restoreBrand reverses',
    async () => {
      const brand = await createKycApprovedBrand();
      const brandId = brand.user.brand!.id;
      await fundBrandWallet(brandId, '50000.00');

      await executeGql(
        `mutation($brandId: ID!, $reason: String!) {
          suspendBrand(brandId: $brandId, reason: $reason) {
            id
            walletStatus
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { brandId, reason: 'Policy review' },
        },
      );

      await expect(login({ email: brand.email, password: brand.password })).rejects.toMatchObject({
        extensions: { code: 'ACCOUNT_SUSPENDED' },
      });

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

      await executeGql(
        `mutation($brandId: ID!, $reason: String!) {
          restoreBrand(brandId: $brandId, reason: $reason) {
            walletStatus
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { brandId, reason: 'Review complete' },
        },
      );

      const { token } = await login({ email: brand.email, password: brand.password });
      expect(token).toBeTruthy();
    },
    120_000,
  );

  it(
    'suspendCreator blocks login; restoreCreator reverses',
    async () => {
      const creator = await createKycApprovedCreator();
      const creatorId = creator.user.creator!.id;
      await fundCreatorWallet(creatorId, '5000.00');

      await executeGql(
        `mutation($creatorId: ID!, $reason: String!) {
          suspendCreator(creatorId: $creatorId, reason: $reason) {
            id
            walletStatus
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { creatorId, reason: 'Compliance hold' },
        },
      );

      await expect(login({ email: creator.email, password: creator.password })).rejects.toMatchObject({
        extensions: { code: 'ACCOUNT_SUSPENDED' },
      });

      await executeGql(
        `mutation($creatorId: ID!, $reason: String!) {
          restoreCreator(creatorId: $creatorId, reason: $reason) {
            walletStatus
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { creatorId, reason: 'Hold lifted' },
        },
      );

      const { token } = await login({ email: creator.email, password: creator.password });
      expect(token).toBeTruthy();
    },
    120_000,
  );

  it(
    'restoreBrand rejects banned users',
    async () => {
      const brand = await createKycApprovedBrand();
      const brandId = brand.user.brand!.id;

      await executeGql(
        `mutation($userId: ID!, $status: UserStatus!) {
          updateUserStatus(userId: $userId, status: $status) { id }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { userId: brand.user.id, status: 'banned' },
        },
      );

      const result = await executeGql(
        `mutation($brandId: ID!, $reason: String!) {
          restoreBrand(brandId: $brandId, reason: $reason) { id }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { brandId, reason: 'Should fail' },
        },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe('INVALID_STATUS');
    },
    60_000,
  );
});
