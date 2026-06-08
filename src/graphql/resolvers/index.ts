import { authResolvers } from '@/graphql/resolvers/auth';
import { kycResolvers } from '@/graphql/resolvers/kyc';
import { notificationsResolvers } from '@/graphql/resolvers/notifications';
import { opportunitiesResolvers } from '@/graphql/resolvers/opportunities';
import { submissionsResolvers } from '@/graphql/resolvers/submissions';
import { walletResolvers } from '@/graphql/resolvers/wallet';

export const resolvers = {
  OpportunityResult: opportunitiesResolvers.OpportunityResult,
  Notification: notificationsResolvers.Notification,
  Query: {
    ...authResolvers.Query,
    ...kycResolvers.Query,
    ...opportunitiesResolvers.Query,
    ...notificationsResolvers.Query,
    ...walletResolvers.Query,
    ...submissionsResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...kycResolvers.Mutation,
    ...opportunitiesResolvers.Mutation,
    ...notificationsResolvers.Mutation,
    ...walletResolvers.Mutation,
    ...submissionsResolvers.Mutation,
  },
};
