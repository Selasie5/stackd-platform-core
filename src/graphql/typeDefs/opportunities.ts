export const opportunitiesTypeDefs = `#graphql
  enum OpportunityType {
    UGC_ORDER
    CPM_DEAL
    CONTEST
  }

  enum OpportunityStatus {
    draft
    pending_approval
    live
    paused
    closed
    cancelled
    completed
  }

  enum OpportunityReviewDecision {
    approved
    rejected
  }

  enum Currency {
    NGN
    GHS
    USD
  }

  enum VideoType {
    ugc
    testimonial
    unboxing
    tutorial
    lifestyle
    trending_audio
    skit
    review
    other
  }

  enum TargetPlatform {
    tiktok
    instagram
    youtube_shorts
    any
  }

  enum UsageRightsPackage {
    basic
    ad
    full
  }

  type ReferenceLink {
    id: ID!
    url: String!
    label: String
  }

  type ContestReferenceLink {
    id: ID!
    url: String!
    label: String
    isInspiration: Boolean!
  }

  type ContestReward {
    id: ID!
    placement: Int!
    label: String
    amount: String!
    currency: Currency!
  }

  interface Opportunity {
    id: ID!
    brandId: ID!
    title: String!
    productName: String!
    shortDescription: String!
    fullDescription: String!
    externalBriefLink: String
    currency: Currency!
    status: OpportunityStatus!
    reservedAt: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type UgcOrder implements Opportunity {
    id: ID!
    brandId: ID!
    title: String!
    productName: String!
    shortDescription: String!
    fullDescription: String!
    externalBriefLink: String
    currency: Currency!
    status: OpportunityStatus!
    reservedAt: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
    videoType: VideoType!
    videoLengthSeconds: Int!
    numberOfCreators: Int!
    flatRatePerCreator: String!
    totalBudget: String!
    requiredShots: String
    wordsToSay: String
    wordsToAvoid: String
    callToAction: String
    usageRightsPackage: UsageRightsPackage!
    postingRequired: Boolean!
    targetPlatform: TargetPlatform
    productDeliveryDetails: String
    revisionLimit: Int!
    deadline: String!
    referenceLinks: [ReferenceLink!]!
  }

  type CpmDeal implements Opportunity {
    id: ID!
    brandId: ID!
    title: String!
    productName: String!
    shortDescription: String!
    fullDescription: String!
    externalBriefLink: String
    currency: Currency!
    status: OpportunityStatus!
    reservedAt: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
    targetPlatform: TargetPlatform!
    requiredHashtags: String
    requiredCaption: String
    requiredBrandTag: String
    payPer1000Views: String!
    maxPayableViewsPerCreator: Int!
    numberOfCreators: Int!
    maxCampaignBudget: String!
    usageRightsPackage: UsageRightsPackage!
    productDeliveryDetails: String
    postingDeadline: String!
    finalViewCountDeadline: String!
    referenceLinks: [ReferenceLink!]!
  }

  type Contest implements Opportunity {
    id: ID!
    brandId: ID!
    title: String!
    productName: String!
    shortDescription: String!
    fullDescription: String!
    externalBriefLink: String
    currency: Currency!
    status: OpportunityStatus!
    reservedAt: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
    category: String
    videoType: VideoType
    videoLengthSeconds: Int
    targetPlatform: TargetPlatform!
    requiredHashtags: String
    requiredCaption: String
    requiredBrandTag: String
    postingRequired: Boolean!
    contestRules: String
    eligibilityRules: String
    usageRightsPackage: UsageRightsPackage!
    productDeliveryDetails: String
    totalContestBudget: String!
    cpmBudget: String
    payPer1000Views: String
    maxPayableViewsPerCreator: Int
    minimumWinners: Int!
    submissionDeadline: String!
    winnerAnnouncementDate: String!
    referenceLinks: [ContestReferenceLink!]!
    rewards: [ContestReward!]!
  }

  union OpportunityResult = UgcOrder | CpmDeal | Contest

  input ReferenceLinkInput {
    url: String!
    label: String
  }

  input ContestReferenceLinkInput {
    url: String!
    label: String
    isInspiration: Boolean
  }

  input ContestRewardInput {
    placement: Int!
    label: String
    amount: String!
    currency: Currency!
  }

  input CreateUgcOrderInput {
    title: String!
    productName: String!
    shortDescription: String!
    fullDescription: String!
    externalBriefLink: String
    videoType: VideoType!
    videoLengthSeconds: Int!
    numberOfCreators: Int!
    flatRatePerCreator: String!
    currency: Currency!
    totalBudget: String!
    requiredShots: String
    wordsToSay: String
    wordsToAvoid: String
    callToAction: String
    usageRightsPackage: UsageRightsPackage!
    postingRequired: Boolean
    targetPlatform: TargetPlatform
    productDeliveryDetails: String
    revisionLimit: Int
    deadline: String!
    referenceLinks: [ReferenceLinkInput!]
  }

  input CreateCpmDealInput {
    title: String!
    productName: String!
    shortDescription: String!
    fullDescription: String!
    externalBriefLink: String
    targetPlatform: TargetPlatform!
    requiredHashtags: String
    requiredCaption: String
    requiredBrandTag: String
    payPer1000Views: String!
    maxPayableViewsPerCreator: Int!
    numberOfCreators: Int!
    maxCampaignBudget: String!
    currency: Currency!
    usageRightsPackage: UsageRightsPackage!
    productDeliveryDetails: String
    postingDeadline: String!
    finalViewCountDeadline: String!
    referenceLinks: [ReferenceLinkInput!]
  }

  input CreateContestInput {
    title: String!
    productName: String!
    shortDescription: String!
    fullDescription: String!
    externalBriefLink: String
    category: String
    videoType: VideoType
    videoLengthSeconds: Int
    targetPlatform: TargetPlatform!
    requiredHashtags: String
    requiredCaption: String
    requiredBrandTag: String
    postingRequired: Boolean
    contestRules: String
    eligibilityRules: String
    usageRightsPackage: UsageRightsPackage!
    productDeliveryDetails: String
    totalContestBudget: String!
    currency: Currency!
    cpmBudget: String
    payPer1000Views: String
    maxPayableViewsPerCreator: Int
    minimumWinners: Int
    submissionDeadline: String!
    winnerAnnouncementDate: String!
    referenceLinks: [ContestReferenceLinkInput!]
    rewards: [ContestRewardInput!]!
  }

  input ReviewOpportunityInput {
    type: OpportunityType!
    id: ID!
    decision: OpportunityReviewDecision!
    adminNote: String
  }

  extend type Query {
    myUgcOrders(status: OpportunityStatus): [UgcOrder!]!
    myCpmDeals(status: OpportunityStatus): [CpmDeal!]!
    myContests(status: OpportunityStatus): [Contest!]!
    ugcOrder(id: ID!): UgcOrder!
    cpmDeal(id: ID!): CpmDeal!
    contest(id: ID!): Contest!
    pendingOpportunities(type: OpportunityType): [OpportunityResult!]!
  }

  extend type Mutation {
    createUgcOrder(input: CreateUgcOrderInput!): UgcOrder!
    updateUgcOrder(id: ID!, input: CreateUgcOrderInput!): UgcOrder!
    deleteUgcOrder(id: ID!): Boolean!
    createCpmDeal(input: CreateCpmDealInput!): CpmDeal!
    updateCpmDeal(id: ID!, input: CreateCpmDealInput!): CpmDeal!
    deleteCpmDeal(id: ID!): Boolean!
    createContest(input: CreateContestInput!): Contest!
    updateContest(id: ID!, input: CreateContestInput!): Contest!
    deleteContest(id: ID!): Boolean!
    submitOpportunityForApproval(type: OpportunityType!, id: ID!): OpportunityResult!
    reviewOpportunity(input: ReviewOpportunityInput!): OpportunityResult!
    pauseOpportunity(type: OpportunityType!, id: ID!): OpportunityResult!
    resumeOpportunity(type: OpportunityType!, id: ID!): OpportunityResult!
    closeOpportunity(type: OpportunityType!, id: ID!): OpportunityResult!
    cancelOpportunity(type: OpportunityType!, id: ID!): OpportunityResult!
    completeOpportunity(type: OpportunityType!, id: ID!): OpportunityResult!
  }
`;
