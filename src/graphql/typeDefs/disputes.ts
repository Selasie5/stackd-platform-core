export const disputesTypeDefs = `#graphql
  enum DisputeStatus {
    open
    under_review
    resolved
    closed
  }

  enum DisputeRaisedBy {
    brand
    creator
    admin
  }

  enum DisputeReferenceType {
    ugc_submission
    cpm_submission
    contest_submission
    payment
  }

  enum DisputeOutcome {
    brand_upheld
    creator_upheld
    dismissed
  }

  type Dispute {
    id: ID!
    raisedBy: DisputeRaisedBy!
    raisedByUserId: ID!
    referenceType: DisputeReferenceType!
    referenceId: ID!
    paymentId: ID
    paymentStatusAtOpen: String
    subject: String!
    description: String!
    status: DisputeStatus!
    assignedTo: ID
    resolution: String
    resolutionOutcome: DisputeOutcome
    resolvedBy: ID
    resolvedAt: String
    createdAt: String!
    updatedAt: String!
    linkedPayment: CreatorPayment
  }

  input OpenDisputeInput {
    referenceType: DisputeReferenceType!
    referenceId: ID!
    subject: String!
    description: String!
  }

  input ResolveDisputeInput {
    disputeId: ID!
    outcome: DisputeOutcome!
    resolution: String!
  }

  extend type Query {
    dispute(id: ID!): Dispute!
    myDisputes(status: DisputeStatus): [Dispute!]!
    adminDisputes(status: DisputeStatus, limit: Int): [Dispute!]!
  }

  extend type Mutation {
    openDispute(input: OpenDisputeInput!): Dispute!
    assignDispute(disputeId: ID!, adminUserId: ID): Dispute!
    resolveDispute(input: ResolveDisputeInput!): Dispute!
  }
`;
