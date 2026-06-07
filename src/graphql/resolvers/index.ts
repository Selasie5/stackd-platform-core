import { authResolvers } from '@/graphql/resolvers/auth';
import { kycResolvers } from '@/graphql/resolvers/kyc';

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...kycResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...kycResolvers.Mutation,
  },
};
