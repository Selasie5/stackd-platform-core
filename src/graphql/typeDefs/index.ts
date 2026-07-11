import { adminTypeDefs } from '@/graphql/typeDefs/admin';
import { authTypeDefs } from '@/graphql/typeDefs/auth';
import { disputesTypeDefs } from '@/graphql/typeDefs/disputes';
import { kycTypeDefs } from '@/graphql/typeDefs/kyc';
import { messagingTypeDefs } from '@/graphql/typeDefs/messaging';
import { notificationsTypeDefs } from '@/graphql/typeDefs/notifications';
import { opportunitiesTypeDefs } from '@/graphql/typeDefs/opportunities';
import { settingsTypeDefs } from '@/graphql/typeDefs/settings';
import { socialTypeDefs } from '@/graphql/typeDefs/social';
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
  settingsTypeDefs,
  socialTypeDefs,
  walletTypeDefs,
  submissionsTypeDefs,
  disputesTypeDefs,
  messagingTypeDefs,
  adminTypeDefs,
];
