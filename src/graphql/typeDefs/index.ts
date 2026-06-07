import { authTypeDefs } from '@/graphql/typeDefs/auth';
import { kycTypeDefs } from '@/graphql/typeDefs/kyc';

export const typeDefs = `#graphql
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;

export const allTypeDefs = [typeDefs, authTypeDefs, kycTypeDefs];
