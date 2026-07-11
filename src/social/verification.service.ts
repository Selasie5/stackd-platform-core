import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { contestSubmissions, cpmSubmissions, creators, ugcSubmissions } from '@/db/schema/index';
import { socialError } from '@/social/errors';
import {
  extractVideoId,
  getChannelByHandle,
  getVideoById,
} from '@/social/youtube.client';
import {
  extractInstagramHandle,
  extractInstagramShortcode,
  getInstagramPost,
  getInstagramProfile,
} from '@/social/instagram.client';
import {
  extractTikTokHandle,
  extractTikTokVideoId,
  getTikTokProfile,
  getTikTokVideo,
} from '@/social/tiktok.client';

type SubmissionType = 'ugc_submission' | 'cpm_submission' | 'contest_submission';

function submissionTable(type: SubmissionType) {
  if (type === 'ugc_submission') return ugcSubmissions;
  if (type === 'cpm_submission') return cpmSubmissions;
  return contestSubmissions;
}

async function getPostedVideoLink(
  type: SubmissionType,
  submissionId: string,
): Promise<string | null> {
  const table = submissionTable(type);
  const rows = await db.select({ postedVideoLink: table.postedVideoLink })
    .from(table)
    .where(eq(table.id, submissionId))
    .limit(1);
  return rows[0]?.postedVideoLink ?? null;
}

export async function verifyCreatorYoutubeChannel(creatorId: string): Promise<{
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  country?: string;
  verifiedAt: Date;
}> {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
    columns: { youtubeHandle: true },
  });

  if (!creator) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Creator not found');
  }

  if (!creator.youtubeHandle) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Creator has no YouTube handle set');
  }

  const channel = await getChannelByHandle(creator.youtubeHandle);
  const verifiedAt = new Date();

  await db
    .update(creators)
    .set({
      youtubeChannelId: channel.channelId,
      youtubeSubscriberCount: channel.subscriberCount,
      youtubeChannelVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    .where(eq(creators.id, creatorId));

  return {
    channelId: channel.channelId,
    title: channel.title,
    description: channel.description,
    thumbnailUrl: channel.thumbnailUrl,
    subscriberCount: channel.subscriberCount,
    videoCount: channel.videoCount,
    viewCount: channel.viewCount,
    country: channel.country,
    verifiedAt,
  };
}

export async function verifyCreatorInstagram(creatorId: string): Promise<{
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  verifiedAt: Date;
}> {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
    columns: { instagramHandle: true },
  });

  if (!creator) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Creator not found');
  }

  if (!creator.instagramHandle) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Creator has no Instagram handle set');
  }

  const profile = await getInstagramProfile(creator.instagramHandle);
  const verifiedAt = new Date();

  await db
    .update(creators)
    .set({
      instagramUserId: profile.userId,
      instagramFollowerCount: profile.followerCount,
      instagramVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    .where(eq(creators.id, creatorId));

  return {
    userId: profile.userId,
    username: profile.username,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    postCount: profile.postCount,
    verifiedAt,
  };
}

export async function verifyCreatorTikTok(creatorId: string): Promise<{
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  likesCount: number;
  verifiedAt: Date;
}> {
  const creator = await db.query.creators.findFirst({
    where: eq(creators.id, creatorId),
    columns: { tiktokHandle: true },
  });

  if (!creator) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Creator not found');
  }

  if (!creator.tiktokHandle) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Creator has no TikTok handle set');
  }

  const profile = await getTikTokProfile(creator.tiktokHandle);
  const verifiedAt = new Date();

  await db
    .update(creators)
    .set({
      tiktokUserId: profile.userId,
      tiktokFollowerCount: profile.followerCount,
      tiktokVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    .where(eq(creators.id, creatorId));

  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    videoCount: profile.videoCount,
    likesCount: profile.likesCount,
    verifiedAt,
  };
}

export async function verifySubmissionVideo(
  submissionType: SubmissionType,
  submissionId: string,
): Promise<{
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  verifiedAt: Date;
}> {
  const postedVideoLink = await getPostedVideoLink(submissionType, submissionId);

  if (postedVideoLink === null) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Submission not found');
  }

  if (!postedVideoLink) {
    throw socialError('SOCIAL_VERIFICATION_FAILED', 'Submission has no posted video link');
  }

  const videoId = extractVideoId(postedVideoLink);
  if (!videoId) {
    throw socialError(
      'SOCIAL_VERIFICATION_FAILED',
      'Could not extract video ID from the posted video link',
    );
  }

  const video = await getVideoById(videoId);
  const verifiedAt = new Date();
  const table = submissionTable(submissionType);

  await db
    .update(table)
    .set({
      autoFetchedViews: video.viewCount,
      autoFetchedLikes: video.likeCount,
      autoFetchedComments: video.commentCount,
      videoVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    .where(eq(table.id, submissionId));

  return {
    videoId: video.videoId,
    title: video.title,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    publishedAt: video.publishedAt,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    verifiedAt,
  };
}
