import { authResolvers } from '@/graphql/resolvers/auth';
import { kycResolvers } from '@/graphql/resolvers/kyc';
import { notificationsResolvers } from '@/graphql/resolvers/notifications';
import { opportunitiesResolvers } from '@/graphql/resolvers/opportunities';

export const resolvers = {
  OpportunityResult: opportunitiesResolvers.OpportunityResult,
  Notification: notificationsResolvers.Notification,
  Query: {
    ...authResolvers.Query,
    ...kycResolvers.Query,
    ...opportunitiesResolvers.Query,
    ...notificationsResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...kycResolvers.Mutation,
    ...opportunitiesResolvers.Mutation,
    ...notificationsResolvers.Mutation,
  },
};
