export const walletTypeDefs = `#graphql
  enum WalletStatus {
    active
    frozen
    closed
  }

  enum TransactionType {
    credit
    debit
    reserve
    release
    payout
    refund
    adjustment
  }

  enum WalletTopUpStatus {
    pending
    completed
    failed
  }

  enum PaymentStatus {
    in_escrow
    awaiting_approval
    ready_for_payout
    paid
    disputed
    refunded
  }

  enum WithdrawalStatus {
    pending
    processing
    completed
    failed
  }

  enum PaymentMethod {
    bank_transfer
    mobile_money
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

  type CreatorWallet {
    id: ID!
    creatorId: ID!
    currency: Currency!
    availableBalance: String!
    totalEarned: String!
    totalWithdrawn: String!
    status: WalletStatus!
    createdAt: String!
    updatedAt: String!
  }

  type BrandWalletTransaction {
    id: ID!
    walletId: ID!
    brandId: ID!
    transactionType: TransactionType!
    amount: String!
    currency: Currency!
    balanceBefore: String!
    balanceAfter: String!
    reservedBefore: String!
    reservedAfter: String!
    description: String
    referenceType: String
    referenceId: ID
    createdAt: String!
  }

  type WalletTopUp {
    id: ID!
    brandId: ID!
    amount: String!
    currency: Currency!
    paystackReference: String!
    status: WalletTopUpStatus!
    completedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type CreatorWalletTransaction {
    id: ID!
    walletId: ID!
    creatorId: ID!
    transactionType: TransactionType!
    amount: String!
    currency: Currency!
    balanceBefore: String!
    balanceAfter: String!
    description: String
    referenceType: String
    referenceId: ID
    createdAt: String!
  }

  type CreatorPayment {
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

  type Withdrawal {
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

  type PaymentDetails {
    method: PaymentMethod!
    bankName: String
    bankCode: String
    accountNumber: String
    accountName: String
    mobileMoneyNumber: String
    mobileMoneyProvider: String
    hasPaystackRecipient: Boolean!
  }

  type WalletTopUpInit {
    topUpId: ID!
    authorizationUrl: String!
    reference: String!
    amount: String!
    currency: Currency!
  }

  input UpdatePaymentDetailsInput {
    method: PaymentMethod!
    bankName: String
    bankCode: String
    accountNumber: String
    accountName: String
    mobileMoneyNumber: String
    mobileMoneyProvider: String
  }

  extend type Query {
    myBrandWallet: BrandWallet!
    myBrandWalletTransactions(limit: Int): [BrandWalletTransaction!]!
    myWalletTopUps(status: WalletTopUpStatus): [WalletTopUp!]!
    myCreatorWallet: CreatorWallet!
    myCreatorWalletTransactions(limit: Int): [CreatorWalletTransaction!]!
    myPayments(status: PaymentStatus): [CreatorPayment!]!
    myWithdrawals(status: WithdrawalStatus): [Withdrawal!]!
    myPaymentDetails: PaymentDetails
    adminWithdrawals(status: WithdrawalStatus, limit: Int): [Withdrawal!]!
    adminPayments(status: PaymentStatus, limit: Int): [CreatorPayment!]!
  }

  extend type Mutation {
    initializeWalletTopUp(amount: String!): WalletTopUpInit!
    verifyWalletTopUp(reference: String!): BrandWallet!
    updatePaymentDetails(input: UpdatePaymentDetailsInput!): PaymentDetails!
    requestWithdrawal(amount: String!): Withdrawal!
  }
`;
