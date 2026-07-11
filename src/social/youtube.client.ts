import { config } from '@/config/index';
import { socialError } from '@/social/errors';

interface YouTubeChannelResult {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  country?: string;
}

interface YouTubeVideoResult {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string {
  if (!config.YOUTUBE_API_KEY) {
    throw socialError(
      'SOCIAL_API_NOT_CONFIGURED',
      'YouTube API key not configured. Set YOUTUBE_API_KEY environment variable.',
    );
  }
  return config.YOUTUBE_API_KEY;
}

export function extractChannelHandle(input: string): string {
  let handle = input.trim();
  if (handle.startsWith('@')) handle = handle.slice(1);
  if (handle.startsWith('http://') || handle.startsWith('https://')) {
    const parts = handle.replace(/\/+$/, '').split('/');
    handle = parts[parts.length - 1]!;
    if (handle.startsWith('@')) handle = handle.slice(1);
  }
  return handle;
}

const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /^([a-zA-Z0-9_-]{11})$/,
];

export function extractVideoId(input: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function youtubeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = getApiKey();
  const query = new URLSearchParams({ key: apiKey, ...params });
  const url = `${YOUTUBE_API_BASE}${path}?${query}`;

  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      throw socialError('SOCIAL_API_QUOTA_EXCEEDED', 'YouTube API quota exceeded');
    }
    if (res.status === 404) {
      throw socialError('SOCIAL_PROFILE_NOT_FOUND', 'YouTube resource not found');
    }
    throw socialError('SOCIAL_API_ERROR', `YouTube API error (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function getChannelByHandle(handle: string): Promise<YouTubeChannelResult> {
  const cleanHandle = extractChannelHandle(handle);

  const data = await youtubeFetch<{
    items: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        thumbnails: { default?: { url: string }; medium?: { url: string } };
        country?: string;
      };
      statistics: {
        subscriberCount: string;
        videoCount: string;
        viewCount: string;
      };
    }>;
  }>('/channels', {
    part: 'snippet,statistics',
    forHandle: cleanHandle,
  });

  const item = data.items?.[0];
  if (!item) {
    throw socialError('SOCIAL_PROFILE_NOT_FOUND', `YouTube channel "@${cleanHandle}" not found`);
  }

  return {
    channelId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    subscriberCount: Number(item.statistics.subscriberCount),
    videoCount: Number(item.statistics.videoCount),
    viewCount: Number(item.statistics.viewCount),
    country: item.snippet.country,
  };
}

export async function getChannelById(channelId: string): Promise<YouTubeChannelResult> {
  const data = await youtubeFetch<{
    items: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        thumbnails: { default?: { url: string }; medium?: { url: string } };
        country?: string;
      };
      statistics: {
        subscriberCount: string;
        videoCount: string;
        viewCount: string;
      };
    }>;
  }>('/channels', {
    part: 'snippet,statistics',
    id: channelId,
  });

  const item = data.items?.[0];
  if (!item) {
    throw socialError('SOCIAL_PROFILE_NOT_FOUND', `YouTube channel "${channelId}" not found`);
  }

  return {
    channelId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    subscriberCount: Number(item.statistics.subscriberCount),
    videoCount: Number(item.statistics.videoCount),
    viewCount: Number(item.statistics.viewCount),
    country: item.snippet.country,
  };
}

export async function getVideoById(videoId: string): Promise<YouTubeVideoResult> {
  const data = await youtubeFetch<{
    items: Array<{
      id: string;
      snippet: {
        title: string;
        publishedAt: string;
        channelId: string;
        channelTitle: string;
      };
      statistics: {
        viewCount: string;
        likeCount: string;
        commentCount: string;
      };
    }>;
  }>('/videos', {
    part: 'snippet,statistics',
    id: videoId,
  });

  const item = data.items?.[0];
  if (!item) {
    throw socialError('SOCIAL_VIDEO_NOT_FOUND', `YouTube video "${videoId}" not found`);
  }

  return {
    videoId: item.id,
    title: item.snippet.title,
    viewCount: Number(item.statistics.viewCount),
    likeCount: Number(item.statistics.likeCount ?? 0),
    commentCount: Number(item.statistics.commentCount ?? 0),
    publishedAt: item.snippet.publishedAt,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
  };
}
