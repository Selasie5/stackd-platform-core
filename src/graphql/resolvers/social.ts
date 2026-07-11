import { requireAuth } from '@/auth/guards';
import type { GraphQLContext } from '@/graphql/context';
import {
  verifyCreatorInstagram,
  verifyCreatorTikTok,
  verifyCreatorYoutubeChannel,
  verifySubmissionVideo,
} from '@/social/verification.service';

export const socialResolvers = {
  Query: {},
  Mutation: {
    verifyCreatorYouTubeChannel: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      if (session.role !== 'creator') {
        throw new Error('Only creators can verify their YouTube channel');
      }
      const result = await verifyCreatorYoutubeChannel(session.creatorId!);
      return {
        channelId: result.channelId,
        title: result.title,
        description: result.description,
        thumbnailUrl: result.thumbnailUrl,
        subscriberCount: result.subscriberCount,
        videoCount: result.videoCount,
        viewCount: result.viewCount,
        country: result.country ?? null,
        verifiedAt: result.verifiedAt.toISOString(),
      };
    },

    verifyCreatorInstagram: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      if (session.role !== 'creator') {
        throw new Error('Only creators can verify their Instagram profile');
      }
      const result = await verifyCreatorInstagram(session.creatorId!);
      return {
        userId: result.userId,
        username: result.username,
        fullName: result.fullName,
        avatarUrl: result.avatarUrl,
        followerCount: result.followerCount,
        followingCount: result.followingCount,
        postCount: result.postCount,
        verifiedAt: result.verifiedAt.toISOString(),
      };
    },

    verifyCreatorTikTok: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      if (session.role !== 'creator') {
        throw new Error('Only creators can verify their TikTok profile');
      }
      const result = await verifyCreatorTikTok(session.creatorId!);
      return {
        userId: result.userId,
        username: result.username,
        displayName: result.displayName,
        avatarUrl: result.avatarUrl,
        followerCount: result.followerCount,
        followingCount: result.followingCount,
        videoCount: result.videoCount,
        likesCount: result.likesCount,
        verifiedAt: result.verifiedAt.toISOString(),
      };
    },

    verifySubmissionVideo: async (
      _: unknown,
      { submissionType, submissionId }: { submissionType: string; submissionId: string },
      ctx: GraphQLContext,
    ) => {
      requireAuth(ctx);
      const result = await verifySubmissionVideo(
        submissionType as 'ugc_submission' | 'cpm_submission' | 'contest_submission',
        submissionId,
      );
      return {
        videoId: result.videoId,
        title: result.title,
        viewCount: result.viewCount,
        likeCount: result.likeCount,
        commentCount: result.commentCount,
        publishedAt: result.publishedAt,
        channelId: result.channelId,
        channelTitle: result.channelTitle,
        verifiedAt: result.verifiedAt.toISOString(),
      };
    },
  },
};
