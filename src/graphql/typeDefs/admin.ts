export const adminTypeDefs = `#graphql
  type AdminOverview {
    pendingKyc: Int!
    pendingCampaigns: Int!
    openDisputes: Int!
    unreadNotifications: Int!
    needsMoreInfoKyc: Int!
    disputedPayments: Int!
    failedWithdrawals: Int!
    processingWithdrawals: Int!
  }

  type AdminUserSummary {
    id: ID!
    email: String!
    role: UserRole!
    status: UserStatus!
    emailVerified: Boolean!
    lastLoginAt: String
    createdAt: String!
    brandName: String
    fullName: String
    kycStatus: String
    brandId: ID
    creatorId: ID
  }

  type AdminUserDetail {
    id: ID!
    email: String!
    role: UserRole!
    status: UserStatus!
    emailVerified: Boolean!
    lastLoginAt: String
    createdAt: String!
    brandName: String
    fullName: String
    kycStatus: String
    brandId: ID
    creatorId: ID
    brandWallet: AdminWalletSummary
    creatorWallet: AdminWalletSummary
  }

  type AdminWalletSummary {
    id: ID!
    status: WalletStatus!
    availableBalance: String!
    reservedBalance: String
    totalEarned: String
    currency: Currency!
  }

  type AdminBrandSummary {
    id: ID!
    userId: ID!
    email: String!
    brandName: String!
    country: String!
    kycStatus: String!
    walletStatus: WalletStatus
    availableBalance: String
    reservedBalance: String
    currency: Currency
    createdAt: String!
  }

  type AdminCreatorSummary {
    id: ID!
    userId: ID!
    email: String!
    fullName: String!
    country: String
    kycStatus: String!
    walletStatus: WalletStatus
    availableBalance: String
    totalEarned: String
    currency: Currency
    createdAt: String!
  }

  type AdminKycSummary {
    id: ID!
    userId: ID!
    status: String!
    attemptNumber: Int!
    profileType: String!
    documents: [KycDocument!]!
    schoolEmail: String
    applicantNote: String
    adminNote: String
    rejectionReason: String
    submittedAt: String!
    reviewedAt: String
    applicantEmail: String
    applicantName: String
    reviewedByEmail: String
  }

  type AdminOpportunitySummary {
    type: OpportunityType!
    id: ID!
    title: String!
    brandId: ID!
    brandName: String!
    status: OpportunityStatus!
    budget: String!
    currency: Currency!
    createdAt: String!
  }

  type AdminPaymentSummary {
    id: ID!
    creatorId: ID!
    creatorName: String
    brandName: String
    opportunityTitle: String
    referenceType: String!
    referenceId: ID!
    opportunityType: String!
    opportunityId: ID!
    amount: String!
    currency: Currency!
    status: PaymentStatus!
    processedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type AdminWithdrawalSummary {
    id: ID!
    creatorId: ID!
    creatorName: String
    creatorEmail: String
    walletId: ID!
    amount: String!
    currency: Currency!
    paystackReference: String!
    paystackStatus: String
    status: WithdrawalStatus!
    failureReason: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type AdminBrandWalletDetail {
    wallet: BrandWallet!
    brandName: String!
    transactions: [BrandWalletTransaction!]!
  }

  type AdminCreatorWalletDetail {
    wallet: CreatorWallet!
    fullName: String!
    transactions: [CreatorWalletTransaction!]!
  }

  union AdminWalletActionResult = AdminBrandWalletDetail | AdminCreatorWalletDetail

  type PaystackEventSummary {
    id: ID!
    eventId: String!
    eventType: String!
    reference: String
    processedAt: String!
    createdAt: String!
  }

  enum WalletProfileType {
    brand
    creator
  }

  input FreezeWalletInput {
    profileType: WalletProfileType!
    profileId: ID!
    reason: String!
  }

  extend type Query {
    adminOverview: AdminOverview!
    adminUsers(role: UserRole, status: UserStatus, search: String, limit: Int): [AdminUserSummary!]!
    adminUser(id: ID!): AdminUserDetail!
    adminBrands(kycStatus: String, search: String, limit: Int): [AdminBrandSummary!]!
    adminCreators(kycStatus: String, search: String, limit: Int): [AdminCreatorSummary!]!
    adminOpportunities(
      type: OpportunityType
      status: OpportunityStatus
      brandId: ID
      search: String
      limit: Int
    ): [AdminOpportunitySummary!]!
    adminKycApplications(status: String, limit: Int): [AdminKycSummary!]!
    adminBrandWallet(brandId: ID!, transactionLimit: Int): AdminBrandWalletDetail!
    adminCreatorWallet(creatorId: ID!, transactionLimit: Int): AdminCreatorWalletDetail!
    adminWalletTopUps(brandId: ID, status: WalletTopUpStatus, limit: Int): [WalletTopUp!]!
    adminPaystackEvents(eventType: String, reference: String, limit: Int): [PaystackEventSummary!]!
  }

  extend type Mutation {
    updateUserStatus(userId: ID!, status: UserStatus!, reason: String): AdminUserDetail!
    freezeWallet(input: FreezeWalletInput!): AdminWalletActionResult!
    unfreezeWallet(input: FreezeWalletInput!): AdminWalletActionResult!
  }
`;
