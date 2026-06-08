import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin, requireBrandWriteAccess, requireCreatorApplyAccess } from '@/kyc/guards';
import { getMyBrandWallet, initializeWalletTopUp } from '@/payments/wallet-funding.service';
import {
  getMyCreatorWallet,
  listAdminPayments,
  listAdminWithdrawals,
  listBrandWalletTopUps,
  listBrandWalletTransactions,
  listCreatorPayments,
  listCreatorWalletTransactions,
  listMyWithdrawals,
} from '@/payments/ledger.service';
import {
  getPaymentDetails,
  updatePaymentDetails,
  type PaymentDetailsInput,
} from '@/payments/payment-details.service';
import { requestWithdrawal } from '@/payments/withdrawal.service';

export const walletResolvers = {
  Query: {
    myBrandWallet: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return getMyBrandWallet(session);
    },
    myBrandWalletTransactions: async (
      _: unknown,
      { limit }: { limit?: number },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return listBrandWalletTransactions(session, limit);
    },
    myWalletTopUps: async (
      _: unknown,
      { status }: { status?: 'pending' | 'completed' | 'failed' },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return listBrandWalletTopUps(session, status);
    },
    myCreatorWallet: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return getMyCreatorWallet(session);
    },
    myCreatorWalletTransactions: async (
      _: unknown,
      { limit }: { limit?: number },
      ctx: GraphQLContext,
    ) => {
      const session = await requireCreatorApplyAccess(ctx);
      return listCreatorWalletTransactions(session, limit);
    },
    myPayments: async (
      _: unknown,
      {
        status,
      }: {
        status?:
          | 'in_escrow'
          | 'awaiting_approval'
          | 'ready_for_payout'
          | 'paid'
          | 'disputed'
          | 'refunded';
      },
      ctx: GraphQLContext,
    ) => {
      const session = await requireCreatorApplyAccess(ctx);
      return listCreatorPayments(session, status);
    },
    myWithdrawals: async (
      _: unknown,
      { status }: { status?: 'pending' | 'processing' | 'completed' | 'failed' },
      ctx: GraphQLContext,
    ) => {
      const session = await requireCreatorApplyAccess(ctx);
      return listMyWithdrawals(session, status);
    },
    myPaymentDetails: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return getPaymentDetails(session);
    },
    adminWithdrawals: async (
      _: unknown,
      {
        status,
        limit,
      }: { status?: 'pending' | 'processing' | 'completed' | 'failed'; limit?: number },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminWithdrawals(status, limit);
    },
    adminPayments: async (
      _: unknown,
      {
        status,
        limit,
      }: {
        status?:
          | 'in_escrow'
          | 'awaiting_approval'
          | 'ready_for_payout'
          | 'paid'
          | 'disputed'
          | 'refunded';
        limit?: number;
      },
      ctx: GraphQLContext,
    ) => {
      requireAdmin(ctx);
      return listAdminPayments(status, limit);
    },
  },
  Mutation: {
    initializeWalletTopUp: async (
      _: unknown,
      { amount }: { amount: string },
      ctx: GraphQLContext,
    ) => {
      const session = await requireBrandWriteAccess(ctx);
      return initializeWalletTopUp(session, amount);
    },
    updatePaymentDetails: async (
      _: unknown,
      { input }: { input: PaymentDetailsInput },
      ctx: GraphQLContext,
    ) => {
      const session = await requireCreatorApplyAccess(ctx);
      return updatePaymentDetails(session, input);
    },
    requestWithdrawal: async (_: unknown, { amount }: { amount: string }, ctx: GraphQLContext) => {
      const session = await requireCreatorApplyAccess(ctx);
      return requestWithdrawal(session, amount);
    },
  },
};
