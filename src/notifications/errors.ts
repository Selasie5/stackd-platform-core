import { GraphQLError } from 'graphql/index.js';

export type NotificationErrorCode = 'NOTIFICATION_NOT_FOUND' | 'FORBIDDEN';

export function notificationError(code: NotificationErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
