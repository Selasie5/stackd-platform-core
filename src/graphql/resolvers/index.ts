import { adminResolvers } from '@/graphql/resolvers/admin';
import { authResolvers } from '@/graphql/resolvers/auth';
import { disputesResolvers } from '@/graphql/resolvers/disputes';
import { kycResolvers } from '@/graphql/resolvers/kyc';
import { messagingResolvers } from '@/graphql/resolvers/messaging';
import { notificationsResolvers } from '@/graphql/resolvers/notifications';
import { opportunitiesResolvers } from '@/graphql/resolvers/opportunities';
import { submissionsResolvers } from '@/graphql/resolvers/submissions';
import { walletResolvers } from '@/graphql/resolvers/wallet';

export const resolvers = {
  OpportunityResult: opportunitiesResolvers.OpportunityResult,
  Notification: notificationsResolvers.Notification,
  Dispute: disputesResolvers.Dispute,
  AdminWalletActionResult: adminResolvers.AdminWalletActionResult,
  Query: {
    ...authResolvers.Query,
    ...kycResolvers.Query,
    ...opportunitiesResolvers.Query,
    ...notificationsResolvers.Query,
    ...walletResolvers.Query,
    ...submissionsResolvers.Query,
    ...disputesResolvers.Query,
    ...messagingResolvers.Query,
    ...adminResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...kycResolvers.Mutation,
    ...opportunitiesResolvers.Mutation,
    ...notificationsResolvers.Mutation,
    ...walletResolvers.Mutation,
    ...submissionsResolvers.Mutation,
    ...disputesResolvers.Mutation,
    ...messagingResolvers.Mutation,
    ...adminResolvers.Mutation,
  },
};
