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

  extend type Query {
    brand: Brand
    activeSessions: [ActiveSession!]!
    notificationPreferences: NotificationPreferences!
  }

  extend type Mutation {
    updateBrand(input: UpdateBrandInput!): Brand!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    revokeSession(sessionId: String!): Boolean!
    updateNotificationPreferences(input: NotificationPreferencesInput!): NotificationPreferences!
  }
`;
