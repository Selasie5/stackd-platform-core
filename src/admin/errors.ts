import { GraphQLError } from 'graphql/index.js';

export type AdminErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_STATUS'
  | 'INVALID_INPUT'
  | 'CANNOT_MODIFY_ADMIN';

export function adminError(code: AdminErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
