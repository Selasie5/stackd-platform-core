import { adminResolvers } from '@/graphql-schema/resolvers/admin';
import { authResolvers } from '@/graphql-schema/resolvers/auth';
import { disputesResolvers } from '@/graphql-schema/resolvers/disputes';
import { kycResolvers } from '@/graphql-schema/resolvers/kyc';
import { messagingResolvers } from '@/graphql-schema/resolvers/messaging';
import { notificationsResolvers } from '@/graphql-schema/resolvers/notifications';
import { opportunitiesResolvers } from '@/graphql-schema/resolvers/opportunities';
import { settingsResolvers } from '@/graphql-schema/resolvers/settings';
import { socialResolvers } from '@/graphql-schema/resolvers/social';
import { submissionsResolvers } from '@/graphql-schema/resolvers/submissions';
import { walletResolvers } from '@/graphql-schema/resolvers/wallet';

export const resolvers = {
  OpportunityResult: opportunitiesResolvers.OpportunityResult,
  Contest: opportunitiesResolvers.Contest,
  Notification: notificationsResolvers.Notification,
  Dispute: disputesResolvers.Dispute,
  AdminWalletActionResult: adminResolvers.AdminWalletActionResult,
  Query: {
    ...authResolvers.Query,
    ...kycResolvers.Query,
    ...opportunitiesResolvers.Query,
    ...notificationsResolvers.Query,
    ...settingsResolvers.Query,
    ...socialResolvers.Query,
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
    ...settingsResolvers.Mutation,
    ...socialResolvers.Mutation,
    ...walletResolvers.Mutation,
    ...submissionsResolvers.Mutation,
    ...disputesResolvers.Mutation,
    ...messagingResolvers.Mutation,
    ...adminResolvers.Mutation,
  },
};
