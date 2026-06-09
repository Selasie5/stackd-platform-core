import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin } from '@/kyc/guards';
import {
  getAdminOverview,
  listAdminUsers,
  getAdminUser,
  listAdminBrands,
  listAdminCreators,
  updateUserStatus,
  getAdminBrandWallet,
  getAdminCreatorWallet,
  listAdminWalletTopUps,
  listAdminPaystackEvents,
  freezeWallet,
  unfreezeWallet,
} from '@/admin/index';
import { listAdminKycApplications } from '@/kyc/kyc.service';
import { listAdminOpportunities } from '@/opportunities/lifecycle.service';
import type { OpportunityStatus, OpportunityType } from '@/opportunities/types';

export const adminResolvers = {
  AdminWalletActionResult: {
    __resolveType(obj: { brandName?: string; fullName?: string }) {
      return obj.brandName !== undefined ? 'AdminBrandWalletDetail' : 'AdminCreatorWalletDetail';
    },
  },
  Query: {
    adminOverview: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAdmin(ctx);
      return getAdminOverview(session.userId);
    },
    adminUsers: async (
      _: unknown,
      {
        role,
        status,
        search,
        limit,
      }: {
        role?: 'admin' | 'brand' | 'creator';
        status?: 'active' | 'suspended' | 'pending' | 'banned';
        search?: string;
        limit?: number;
      },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminUsers({ role, status, search, limit });
    },
    adminUser: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requireAdmin(ctx);
      return getAdminUser(id);
    },
    adminBrands: async (
      _: unknown,
      { kycStatus, search, limit }: { kycStatus?: string; search?: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminBrands({ kycStatus, search, limit });
    },
    adminCreators: async (
      _: unknown,
      { kycStatus, search, limit }: { kycStatus?: string; search?: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminCreators({ kycStatus, search, limit });
    },
    adminOpportunities: async (
      _: unknown,
      {
        type,
        status,
        brandId,
        search,
        limit,
      }: {
        type?: OpportunityType;
        status?: OpportunityStatus;
        brandId?: string;
        search?: string;
        limit?: number;
      },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminOpportunities({ type, status, brandId, search, limit });
    },
    adminKycApplications: async (
      _: unknown,
      {
        status,
        limit,
      }: {
        status?: 'not_started' | 'pending_review' | 'approved' | 'rejected' | 'needs_more_info';
        limit?: number;
      },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminKycApplications(status, limit);
    },
    adminBrandWallet: async (
      _: unknown,
      { brandId, transactionLimit }: { brandId: string; transactionLimit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return getAdminBrandWallet(brandId, transactionLimit);
    },
    adminCreatorWallet: async (
      _: unknown,
      { creatorId, transactionLimit }: { creatorId: string; transactionLimit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return getAdminCreatorWallet(creatorId, transactionLimit);
    },
    adminWalletTopUps: async (
      _: unknown,
      {
        brandId,
        status,
        limit,
      }: { brandId?: string; status?: 'pending' | 'completed' | 'failed'; limit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminWalletTopUps({ brandId, status, limit });
    },
    adminPaystackEvents: async (
      _: unknown,
      {
        eventType,
        reference,
        limit,
      }: { eventType?: string; reference?: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminPaystackEvents({ eventType, reference, limit });
    },
  },
  Mutation: {
    updateUserStatus: async (
      _: unknown,
      {
        userId,
        status,
        reason,
      }: { userId: string; status: 'active' | 'suspended' | 'banned'; reason?: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAdmin(ctx);
      return updateUserStatus(session, { userId, status, reason });
    },
    freezeWallet: async (
      _: unknown,
      { input }: { input: { profileType: 'brand' | 'creator'; profileId: string; reason: string } },
      ctx: GraphQLContext,
    ) => {
      const session = requireAdmin(ctx);
      return freezeWallet(session, input);
    },
    unfreezeWallet: async (
      _: unknown,
      { input }: { input: { profileType: 'brand' | 'creator'; profileId: string; reason: string } },
      ctx: GraphQLContext,
    ) => {
      const session = requireAdmin(ctx);
      return unfreezeWallet(session, input);
    },
  },
};
