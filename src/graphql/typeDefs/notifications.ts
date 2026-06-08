export const notificationsTypeDefs = `#graphql
  enum NotificationType {
    kyc_submitted
    kyc_approved
    kyc_rejected
    kyc_needs_more_info
    verification_submitted
    verification_approved
    verification_rejected
    new_contest_launched
    new_ugc_order_launched
    new_cpm_deal_launched
    submission_received
    video_approved
    revision_requested
    shortlisted
    winner_selected
    payment_ready
    payment_paid
    wallet_funded
    wallet_insufficient
    contest_ending_soon
    application_accepted
    application_rejected
    dispute_opened
    dispute_resolved
    admin_kyc_pending_review
    admin_campaign_pending_review
    admin_dispute_opened
  }

  type Notification {
    id: ID!
    userId: ID!
    type: NotificationType!
    title: String!
    body: String!
    referenceType: String
    referenceId: ID
    isRead: Boolean!
    readAt: String
    createdAt: String!
  }

  type AdminActionCounts {
    pendingKyc: Int!
    pendingCampaigns: Int!
    openDisputes: Int!
    unreadNotifications: Int!
  }

  extend type Query {
    myNotifications(unreadOnly: Boolean): [Notification!]!
    unreadNotificationCount: Int!
    adminActionCounts: AdminActionCounts!
  }

  extend type Mutation {
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Int!
    registerDeviceToken(token: String!, platform: String!): Boolean!
    removeDeviceToken(token: String!): Boolean!
  }
`;
