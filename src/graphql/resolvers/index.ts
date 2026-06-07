import { authResolvers } from '@/graphql/resolvers/auth';
import { kycResolvers } from '@/graphql/resolvers/kyc';
import { opportunitiesResolvers } from '@/graphql/resolvers/opportunities';

export const resolvers = {
  OpportunityResult: opportunitiesResolvers.OpportunityResult,
  Query: {
    ...authResolvers.Query,
    ...kycResolvers.Query,
    ...opportunitiesResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...kycResolvers.Mutation,
    ...opportunitiesResolvers.Mutation,
  },
};
