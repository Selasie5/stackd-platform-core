import { authTypeDefs } from '@/graphql/typeDefs/auth';
import { kycTypeDefs } from '@/graphql/typeDefs/kyc';
import { notificationsTypeDefs } from '@/graphql/typeDefs/notifications';
import { opportunitiesTypeDefs } from '@/graphql/typeDefs/opportunities';

export const typeDefs = `#graphql
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;

export const allTypeDefs = [
  typeDefs,
  authTypeDefs,
  kycTypeDefs,
  opportunitiesTypeDefs,
  notificationsTypeDefs,
];
