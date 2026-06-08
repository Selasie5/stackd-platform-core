import type { GraphQLContext } from '@/graphql/context';
import { requireBrandWriteAccess } from '@/kyc/guards';
import {
  getMyBrandWallet,
  initializeWalletTopUp,
} from '@/payments/wallet-funding.service';

export const walletResolvers = {
  Query: {
    myBrandWallet: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = await requireBrandWriteAccess(ctx);
      return getMyBrandWallet(session);
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
  },
};
