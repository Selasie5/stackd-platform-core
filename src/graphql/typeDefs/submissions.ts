export const submissionsTypeDefs = `#graphql
  enum SubmissionStatus {
    submitted
    under_review
    shortlisted
    revision_requested
    resubmitted
    winner
    approved
    rejected
    disqualified
    paid
  }

  type UgcSubmission {
    id: ID!
    ugcOrderId: ID!
    creatorId: ID!
    opportunityTitle: String
    brandName: String
    potentialPayout: String
    currency: Currency
    paymentAmount: String
    paymentDate: String
    paymentStatus: PaymentStatus
    videoUrl: String
    thumbnailUrl: String
    watermarkedPreviewUrl: String
    cleanVideoUrl: String
    submissionNote: String
    revisionNumber: Int!
    revisionNote: String
    postingRequired: Boolean!
    postedVideoLink: String
    status: SubmissionStatus!
    approvedAt: String
    cleanVideoReleasedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type CpmSubmission {
    id: ID!
    cpmDealId: ID!
    creatorId: ID!
    opportunityTitle: String
    brandName: String
    potentialPayout: String
    currency: Currency
    paymentAmount: String
    paymentDate: String
    paymentStatus: PaymentStatus
    postedVideoLink: String!
    platform: TargetPlatform!
    submissionNote: String
    analyticsScreenshotUrl: String
    submittedViews: Int!
    approvedViews: Int
    engagementCount: Int!
    calculatedPayout: String
    viewVerificationStatus: String!
    status: SubmissionStatus!
    createdAt: String!
    updatedAt: String!
  }

  type ContestSubmission {
    id: ID!
    contestId: ID!
    creatorId: ID!
    opportunityTitle: String
    brandName: String
    potentialPayout: String
    currency: Currency
    paymentAmount: String
    paymentDate: String
    paymentStatus: PaymentStatus
    videoUrl: String
    videoLink: String
    thumbnailUrl: String
    watermarkedPreviewUrl: String
    cleanVideoUrl: String
    submissionNote: String
    postingRequired: Boolean!
    postedVideoLink: String
    platform: TargetPlatform
    submittedViews: Int!
    approvedViews: Int
    engagementCount: Int!
    leaderboardScore: Int!
    placement: Int
    rewardAmount: String
    status: SubmissionStatus!
    shortlistedAt: String
    winnerSelectedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type ContestLeaderboardEntry {
    rank: Int!
    submissionId: ID!
    leaderboardScore: Int!
    thumbnailUrl: String
    placement: Int
    creatorDisplayName: String!
    status: SubmissionStatus!
    createdAt: String!
  }

  input SubmitUgcSubmissionInput {
    ugcOrderId: ID!
    videoUrl: String
    thumbnailUrl: String
    watermarkedPreviewUrl: String
    submissionNote: String
    postedVideoLink: String
  }

  input ResubmitUgcSubmissionInput {
    submissionId: ID!
    videoUrl: String
    thumbnailUrl: String
    watermarkedPreviewUrl: String
    submissionNote: String
    postedVideoLink: String
  }

  input SubmitCpmSubmissionInput {
    cpmDealId: ID!
    postedVideoLink: String!
    platform: TargetPlatform!
    submissionNote: String
    analyticsScreenshotUrl: String
    submittedViews: Int
    engagementCount: Int
  }

  input SubmitContestSubmissionInput {
    contestId: ID!
    videoUrl: String
    videoLink: String
    thumbnailUrl: String
    watermarkedPreviewUrl: String
    submissionNote: String
    postedVideoLink: String
    platform: TargetPlatform
    submittedViews: Int
    engagementCount: Int
    confirmedFollowsBrief: Boolean!
    confirmedOriginal: Boolean!
    confirmedNoFakeEngagement: Boolean!
    agreedToUsageRights: Boolean!
  }

  input ContestWinnerInput {
    submissionId: ID!
    placement: Int!
  }

  input SelectContestWinnersInput {
    contestId: ID!
    winners: [ContestWinnerInput!]!
  }

  extend type Query {
    liveUgcOrders: [UgcOrder!]!
    liveCpmDeals: [CpmDeal!]!
    liveContests: [Contest!]!
    liveContest(id: ID!): Contest!
    contestSubmissionCount(contestId: ID!): Int!
    contestPublicLeaderboard(contestId: ID!, limit: Int = 20): [ContestLeaderboardEntry!]!
    myUgcSubmissions: [UgcSubmission!]!
    myCpmSubmissions: [CpmSubmission!]!
    myContestSubmissions: [ContestSubmission!]!
    ugcSubmissions(orderId: ID!): [UgcSubmission!]!
    cpmSubmissions(dealId: ID!): [CpmSubmission!]!
    contestSubmissions(contestId: ID!): [ContestSubmission!]!
  }

  extend type Mutation {
    submitUgcSubmission(input: SubmitUgcSubmissionInput!): UgcSubmission!
    requestUgcRevision(submissionId: ID!, revisionNote: String!): UgcSubmission!
    resubmitUgcSubmission(input: ResubmitUgcSubmissionInput!): UgcSubmission!
    approveUgcSubmission(submissionId: ID!): UgcSubmission!
    rejectUgcSubmission(submissionId: ID!): UgcSubmission!
    submitCpmSubmission(input: SubmitCpmSubmissionInput!): CpmSubmission!
    verifyCpmViews(submissionId: ID!, approvedViews: Int!): CpmSubmission!
    approveCpmSubmission(submissionId: ID!): CpmSubmission!
    submitContestSubmission(input: SubmitContestSubmissionInput!): ContestSubmission!
    shortlistContestSubmission(submissionId: ID!): ContestSubmission!
    selectContestWinners(input: SelectContestWinnersInput!): [ContestSubmission!]!
  }
`;
