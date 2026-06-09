import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  createVerifiedBrand,
  ensureAdminSession,
} from '../../helpers/factories';

describe('admin directory', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'searches users by email and lists brands by kyc status',
    async () => {
      const brand = await createKycApprovedBrand({ brandName: 'Admin Dir Brand' });

      const usersResult = await executeGql<{
        adminUsers: { email: string; brandName: string | null }[];
      }>(
        `query($search: String) {
          adminUsers(search: $search, role: brand, limit: 10) {
            email
            brandName
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { search: brand.email },
        },
      );

      expect(usersResult.errors).toBeUndefined();
      expect(usersResult.data?.adminUsers.some((u) => u.email === brand.email)).toBe(true);

      const brandsResult = await executeGql<{
        adminBrands: { brandName: string; kycStatus: string }[];
      }>(
        `query {
          adminBrands(kycStatus: "approved", search: "Admin Dir Brand", limit: 10) {
            brandName
            kycStatus
          }
        }`,
        { sessionToken: adminSession.sessionToken },
      );

      expect(brandsResult.errors).toBeUndefined();
      expect(
        brandsResult.data?.adminBrands.some((b) => b.brandName === 'Admin Dir Brand'),
      ).toBe(true);

      const userDetail = await executeGql<{
        adminUser: { email: string; brandWallet: { status: string } | null };
      }>(
        `query($id: ID!) {
          adminUser(id: $id) {
            email
            brandWallet { status }
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: { id: brand.user.id },
        },
      );

      expect(userDetail.data?.adminUser.email).toBe(brand.email);
      expect(userDetail.data?.adminUser.brandWallet?.status).toBe('active');
    },
    120_000,
  );

  it(
    'rejects non-admin access',
    async () => {
      const brand = await createVerifiedBrand();
      const result = await executeGql(`query { adminUsers { id } }`, {
        sessionToken: brand.sessionToken,
      });
      expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    },
    60_000,
  );
});
