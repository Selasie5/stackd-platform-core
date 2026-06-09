export const kycTypeDefs = `#graphql
  type KycDocument {
    documentType: String!
    fileUrl: String!
    fileName: String
    note: String
  }

  type KycApplication {
    id: ID!
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
    userId: ID
    applicantEmail: String
    applicantName: String
    reviewedByEmail: String
  }

  input KycDocumentInput {
    documentType: String!
    fileUrl: String!
    fileName: String
    note: String
  }

  input SubmitKycInput {
    documents: [KycDocumentInput!]!
    schoolEmail: String
    applicantNote: String
  }

  enum KycReviewDecision {
    approved
    rejected
    needs_more_info
  }

  input ReviewKycInput {
    applicationId: ID!
    decision: KycReviewDecision!
    adminNote: String
    rejectionReason: String
  }

  extend type Query {
    myKycApplication: KycApplication
    pendingKycApplications: [KycApplication!]!
  }

  extend type Mutation {
    submitKyc(input: SubmitKycInput!): KycApplication!
    reviewKyc(input: ReviewKycInput!): KycApplication!
  }
`;
