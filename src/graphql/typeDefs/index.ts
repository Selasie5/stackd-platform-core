import { authTypeDefs } from '@/graphql/typeDefs/auth';
import { disputesTypeDefs } from '@/graphql/typeDefs/disputes';
import { kycTypeDefs } from '@/graphql/typeDefs/kyc';
import { messagingTypeDefs } from '@/graphql/typeDefs/messaging';
import { notificationsTypeDefs } from '@/graphql/typeDefs/notifications';
import { opportunitiesTypeDefs } from '@/graphql/typeDefs/opportunities';
import { submissionsTypeDefs } from '@/graphql/typeDefs/submissions';
import { walletTypeDefs } from '@/graphql/typeDefs/wallet';

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
  walletTypeDefs,
  submissionsTypeDefs,
  disputesTypeDefs,
  messagingTypeDefs,
];
