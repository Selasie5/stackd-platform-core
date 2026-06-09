import { GraphQLError } from 'graphql';

export type AuthErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'INVALID_CREDENTIALS'
  | 'USER_ALREADY_EXISTS'
  | 'USER_NOT_FOUND'
  | 'INVALID_TOKEN'
  | 'ACCOUNT_SUSPENDED'
  | 'RATE_LIMITED'
  | 'INVALID_OTP'
  | 'OTP_ATTEMPTS_EXCEEDED';

export function authError(code: AuthErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
