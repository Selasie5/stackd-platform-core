export const settingsTypeDefs = `#graphql
  extend type Brand {
    contactName: String
    city: String
    country: String!
    industry: String
    description: String
    website: String
    logoUrl: String
    createdAt: String!
  }

  type ActiveSession {
    id: ID!
    deviceName: String!
    platform: String!
    ipAddress: String
    lastActiveAt: String!
    createdAt: String!
    isCurrent: Boolean!
  }

  type NotificationPreferences {
    emailMarketing: Boolean!
    emailSecurity: Boolean!
    emailCampaignUpdates: Boolean!
    pushMarketing: Boolean!
    pushSecurity: Boolean!
    pushCampaignUpdates: Boolean!
  }

  input UpdateBrandInput {
    brandName: String
    contactName: String
    city: String
    country: String
    industry: String
    description: String
    website: String
    logoUrl: String
  }

  input NotificationPreferencesInput {
    emailMarketing: Boolean
    emailSecurity: Boolean
    emailCampaignUpdates: Boolean
    pushMarketing: Boolean
    pushSecurity: Boolean
    pushCampaignUpdates: Boolean
  }

  type CreatorSample {
    id: ID!
    title: String!
    category: String!
    videoUrl: String
    externalLink: String
    note: String
  }

  input CreatorSampleInput {
    title: String!
    category: String!
    videoUrl: String
    externalLink: String
    note: String
  }

  extend type Creator {
    otherNiches: [String!]!
    tiktokHandle: String
    instagramHandle: String
    youtubeHandle: String
    languagesSpoken: [String!]!
    equipment: [String!]!
    availability: String
    samples: [CreatorSample!]!
    createdAt: String!
  }

  input UpdateCreatorProfileInput {
    fullName: String
    school: String
    country: String
    city: String
    phone: String
    bio: String
    profileImage: String
    mainNiche: String
    otherNiches: [String!]
    tiktokHandle: String
    instagramHandle: String
    youtubeHandle: String
    languagesSpoken: [String!]
    equipment: [String!]
    availability: String
    samples: [CreatorSampleInput!]
    completeProfile: Boolean
  }

  extend type Query {
    brand: Brand
    creator: Creator
    activeSessions: [ActiveSession!]!
    notificationPreferences: NotificationPreferences!
  }

  extend type Mutation {
    updateBrand(input: UpdateBrandInput!): Brand!
    updateCreatorProfile(input: UpdateCreatorProfileInput!): Creator!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    revokeSession(sessionId: String!): Boolean!
    updateNotificationPreferences(input: NotificationPreferencesInput!): NotificationPreferences!
  }
`;
