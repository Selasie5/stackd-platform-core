import { socialError } from '@/social/errors';

interface InstagramProfileResult {
  userId: string;
  username: string;
  fullName: string;
  biography: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isPrivate: boolean;
}

interface InstagramPostResult {
  shortcode: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  caption: string;
}

export function extractInstagramHandle(input: string): string {
  let handle = input.trim();
  const urlMatch = handle.match(
    /(?:instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?)?([a-zA-Z0-9_.]{1,30})/,
  );
  if (urlMatch?.[1]) {
    handle = urlMatch[1].replace(/\/+$/, '');
    if (handle.startsWith('@')) handle = handle.slice(1);
  }
  return handle;
}

export function extractInstagramShortcode(input: string): string | null {
  const patterns = [
    /(?:instagram\.com\/p\/|instagram\.com\/reel\/|instagram\.com\/reels\/)([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function instagramFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  if (res.status === 404) {
    throw socialError('SOCIAL_PROFILE_NOT_FOUND', 'Instagram profile not found');
  }

  if (!res.ok) {
    throw socialError('SOCIAL_API_ERROR', `Instagram API error (${res.status})`);
  }

  const body = await res.json();
  return body as T;
}

export async function getInstagramProfile(handle: string): Promise<InstagramProfileResult> {
  const cleanHandle = extractInstagramHandle(handle);

  const data = await instagramFetch<{
    data?: {
      user?: {
        id: string;
        username: string;
        full_name: string;
        biography: string;
        profile_pic_url_hd: string;
        edge_followed_by: { count: number };
        edge_follow: { count: number };
        edge_owner_to_timeline_media: { count: number };
        is_private: boolean;
      };
    };
  }>(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanHandle}`);

  const user = data?.data?.user;
  if (!user) {
    throw socialError('SOCIAL_PROFILE_NOT_FOUND', `Instagram user "${cleanHandle}" not found`);
  }

  return {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    biography: user.biography,
    avatarUrl: user.profile_pic_url_hd,
    followerCount: user.edge_followed_by.count,
    followingCount: user.edge_follow.count,
    postCount: user.edge_owner_to_timeline_media.count,
    isPrivate: user.is_private,
  };
}

export async function getInstagramPost(shortcode: string): Promise<InstagramPostResult> {
  const data = await instagramFetch<{
    items?: Array<{
      code: string;
      like_count: number;
      comment_count: number;
      view_count?: number;
      caption?: { text: string };
    }>;
  }>(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=1`);

  const item = data?.items?.[0];
  if (!item) {
    throw socialError('SOCIAL_VIDEO_NOT_FOUND', `Instagram post "${shortcode}" not found`);
  }

  return {
    shortcode: item.code,
    likeCount: item.like_count ?? 0,
    commentCount: item.comment_count ?? 0,
    viewCount: item.view_count ?? 0,
    caption: item.caption?.text ?? '',
  };
}
