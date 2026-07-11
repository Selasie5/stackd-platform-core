export const socialTypeDefs = `#graphql
  type YouTubeChannelInfo {
    channelId: String!
    title: String!
    description: String!
    thumbnailUrl: String!
    subscriberCount: Int!
    videoCount: Int!
    viewCount: Int!
    country: String
    verifiedAt: String!
  }

  type YouTubeVideoInfo {
    videoId: String!
    title: String!
    viewCount: Int!
    likeCount: Int!
    commentCount: Int!
    publishedAt: String!
    channelId: String!
    channelTitle: String!
    verifiedAt: String!
  }

  type InstagramProfileInfo {
    userId: String!
    username: String!
    fullName: String!
    avatarUrl: String!
    followerCount: Int!
    followingCount: Int!
    postCount: Int!
    verifiedAt: String!
  }

  type TikTokProfileInfo {
    userId: String!
    username: String!
    displayName: String!
    avatarUrl: String!
    followerCount: Int!
    followingCount: Int!
    videoCount: Int!
    likesCount: Int!
    verifiedAt: String!
  }

  type SocialVerificationResult {
    success: Boolean!
    message: String
    youtubeChannel: YouTubeChannelInfo
    youtubeVideo: YouTubeVideoInfo
  }

  type SocialHandleCheckResult {
    valid: Boolean!
    platform: String!
    displayName: String
    avatarUrl: String
    followerCount: Int
    error: String
  }

  extend type Query {
    checkSocialHandle(platform: String!, handle: String!): SocialHandleCheckResult!
  }

  extend type Mutation {
    verifyCreatorYouTubeChannel: YouTubeChannelInfo!
    verifyCreatorInstagram: InstagramProfileInfo!
    verifyCreatorTikTok: TikTokProfileInfo!
    verifySubmissionVideo(
      submissionType: String!
      submissionId: ID!
    ): YouTubeVideoInfo!
  }
`;
