import { GraphQLError } from 'graphql/index.js';

export type SocialErrorCode =
  | 'SOCIAL_API_NOT_CONFIGURED'
  | 'SOCIAL_API_ERROR'
  | 'SOCIAL_API_QUOTA_EXCEEDED'
  | 'SOCIAL_PROFILE_NOT_FOUND'
  | 'SOCIAL_VIDEO_NOT_FOUND'
  | 'SOCIAL_VERIFICATION_FAILED'
  | 'SOCIAL_PRIVATE_PROFILE';

export function socialError(code: SocialErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
