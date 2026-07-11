import { requireAuth } from '@/auth/guards';
import type { GraphQLContext } from '@/graphql/context';
import {
  verifyCreatorInstagram,
  verifyCreatorTikTok,
  verifyCreatorYoutubeChannel,
  verifySubmissionVideo,
} from '@/social/verification.service';
import { getChannelByHandle } from '@/social/youtube.client';
import { getInstagramProfile } from '@/social/instagram.client';
import { getTikTokProfile } from '@/social/tiktok.client';
import { extractChannelHandle } from '@/social/youtube.client';
import { extractInstagramHandle } from '@/social/instagram.client';
import { extractTikTokHandle } from '@/social/tiktok.client';
import { getCached, setCache } from '@/utils/cache';

interface SocialHandleCheckResult {
  valid: boolean;
  platform: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  error: string | null;
}

export const socialResolvers = {
  Query: {
    checkSocialHandle: async (
      _: unknown,
      { platform, handle }: { platform: string; handle: string },
    ) => {
      const trimmed = handle?.trim()
      if (!trimmed) {
        return { valid: false, platform, displayName: null, avatarUrl: null, followerCount: null, error: null };
      }

      const cacheKey = `checkSocialHandle:${platform}:${trimmed.toLowerCase()}`
      const cached = getCached<SocialHandleCheckResult>(cacheKey)
      if (cached) return cached

      try {
        let result: SocialHandleCheckResult

        if (platform === 'youtube') {
          const channel = await getChannelByHandle(trimmed);
          result = {
            valid: true,
            platform,
            displayName: channel.title,
            avatarUrl: channel.thumbnailUrl,
            followerCount: channel.subscriberCount,
            error: null,
          };
        } else if (platform === 'instagram') {
          const profile = await getInstagramProfile(trimmed);
          result = {
            valid: true,
            platform,
            displayName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            followerCount: profile.followerCount,
            error: null,
          };
        } else if (platform === 'tiktok') {
          const profile = await getTikTokProfile(trimmed);
          result = {
            valid: true,
            platform,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            followerCount: profile.followerCount,
            error: null,
          };
        } else {
          result = { valid: false, platform, displayName: null, avatarUrl: null, followerCount: null, error: 'Unknown platform' };
        }

        setCache(cacheKey, result, 300_000)
        return result
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        const errorResult: SocialHandleCheckResult = { valid: false, platform, displayName: null, avatarUrl: null, followerCount: null, error: message };
        setCache(cacheKey, errorResult, 30_000)
        return errorResult
      }
    },
  },
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
