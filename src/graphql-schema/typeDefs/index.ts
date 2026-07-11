import { adminTypeDefs } from '@/graphql-schema/typeDefs/admin';
import { authTypeDefs } from '@/graphql-schema/typeDefs/auth';
import { disputesTypeDefs } from '@/graphql-schema/typeDefs/disputes';
import { kycTypeDefs } from '@/graphql-schema/typeDefs/kyc';
import { messagingTypeDefs } from '@/graphql-schema/typeDefs/messaging';
import { notificationsTypeDefs } from '@/graphql-schema/typeDefs/notifications';
import { opportunitiesTypeDefs } from '@/graphql-schema/typeDefs/opportunities';
import { settingsTypeDefs } from '@/graphql-schema/typeDefs/settings';
import { socialTypeDefs } from '@/graphql-schema/typeDefs/social';
import { submissionsTypeDefs } from '@/graphql-schema/typeDefs/submissions';
import { walletTypeDefs } from '@/graphql-schema/typeDefs/wallet';

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
