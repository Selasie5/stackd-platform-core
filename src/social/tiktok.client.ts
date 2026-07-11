import { socialError } from '@/social/errors';

interface TikTokProfileResult {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  likesCount: number;
}

interface TikTokVideoResult {
  videoId: string;
  description: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  authorUniqueId: string;
}

export function extractTikTokHandle(input: string): string {
  let handle = input.trim();
  if (handle.startsWith('http://') || handle.startsWith('https://')) {
    const parts = handle.replace(/\/+$/, '').split('/');
    handle = parts[parts.length - 1]!;
  }
  if (handle.startsWith('@')) handle = handle.slice(1);
  return handle;
}

export function extractTikTokVideoId(input: string): string | null {
  const patterns = [
    /(?:tiktok\.com\/@[\w.-]+\/video\/|tiktok\.com\/t\/)(\d+)/,
    /vm\.tiktok\.com\/([a-zA-Z0-9]+)/,
    /^(\d{19})$/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function tiktokFetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw socialError('SOCIAL_PROFILE_NOT_FOUND', 'TikTok resource not found');
    }
    throw socialError('SOCIAL_API_ERROR', `TikTok API error (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export async function getTikTokProfile(handle: string): Promise<TikTokProfileResult> {
  const cleanHandle = extractTikTokHandle(handle);

  const oembedData = await tiktokFetchJson<{
    author_name?: string;
    author_url?: string;
    author_unique_id?: string;
    thumbnail_url?: string;
  }>(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${cleanHandle}`);

  if (!oembedData.author_unique_id) {
    throw socialError('SOCIAL_PROFILE_NOT_FOUND', `TikTok user "${cleanHandle}" not found`);
  }

  const htmlRes = await fetch(`https://www.tiktok.com/@${cleanHandle}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!htmlRes.ok) {
    throw socialError('SOCIAL_PROFILE_NOT_FOUND', `TikTok user "${cleanHandle}" not found`);
  }

  const html = await htmlRes.text();

  const stateMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
  let followerCount = 0;
  let followingCount = 0;
  let videoCount = 0;
  let likesCount = 0;
  let userId = '';
  let displayName = '';
  let avatarUrl = '';

  if (stateMatch?.[1]) {
    try {
      const state = JSON.parse(stateMatch[1]);
      const userInfo = state?.props?.pageProps?.userInfo;
      if (userInfo) {
        userId = userInfo.user?.id ?? '';
        displayName = userInfo.user?.nickname ?? oembedData.author_name ?? '';
        avatarUrl = userInfo.user?.avatarMedium ?? '';
        followerCount = userInfo.stats?.followerCount ?? 0;
        followingCount = userInfo.stats?.followingCount ?? 0;
        videoCount = userInfo.stats?.videoCount ?? 0;
        likesCount = userInfo.stats?.heartCount ?? 0;
      }
    } catch {
    }
  }

  return {
    userId,
    username: oembedData.author_unique_id,
    displayName: displayName || oembedData.author_name || cleanHandle,
    avatarUrl: avatarUrl || oembedData.thumbnail_url || '',
    bio: '',
    followerCount,
    followingCount,
    videoCount,
    likesCount,
  };
}

export async function getTikTokVideo(videoId: string): Promise<TikTokVideoResult> {
  const oembedData = await tiktokFetchJson<{
    author_unique_id?: string;
    title?: string;
  }>(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@x/video/${videoId}`);

  const htmlRes = await fetch(`https://www.tiktok.com/@x/video/${videoId}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  let viewCount = 0;
  let likeCount = 0;
  let commentCount = 0;
  let shareCount = 0;

  if (htmlRes.ok) {
    const html = await htmlRes.text();
    const stateMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/);
    if (stateMatch?.[1]) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const videoData = state?.props?.pageProps?.videoData;
        if (videoData) {
          viewCount = Number(videoData.stats?.playCount ?? 0);
          likeCount = Number(videoData.stats?.diggCount ?? 0);
          commentCount = Number(videoData.stats?.commentCount ?? 0);
          shareCount = Number(videoData.stats?.shareCount ?? 0);
        }
      } catch {
      }
    }
  }

  return {
    videoId,
    description: oembedData.title ?? '',
    viewCount,
    likeCount,
    commentCount,
    shareCount,
    authorUniqueId: oembedData.author_unique_id ?? '',
  };
}
