export const walletTypeDefs = `#graphql
  enum WalletStatus {
    active
    frozen
    closed
  }

  type BrandWallet {
    id: ID!
    brandId: ID!
    currency: Currency!
    availableBalance: String!
    reservedBalance: String!
    totalSpent: String!
    status: WalletStatus!
    createdAt: String!
    updatedAt: String!
  }

  type WalletTopUpInit {
    topUpId: ID!
    authorizationUrl: String!
    reference: String!
    amount: String!
    currency: Currency!
  }

  extend type Query {
    myBrandWallet: BrandWallet!
  }

  extend type Mutation {
    initializeWalletTopUp(amount: String!): WalletTopUpInit!
  }
`;
