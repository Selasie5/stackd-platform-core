import { GraphQLError } from 'graphql';

export type MessageErrorCode =
  | 'MESSAGE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_REFERENCE'
  | 'RECIPIENT_NOT_FOUND';

export function messageError(code: MessageErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
