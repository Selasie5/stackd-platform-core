import { GraphQLError } from 'graphql/index.js';

export type DisputeErrorCode =
  | 'DISPUTE_NOT_FOUND'
  | 'DISPUTE_ALREADY_OPEN'
  | 'INVALID_REFERENCE'
  | 'INVALID_STATUS'
  | 'FORBIDDEN'
  | 'PAYMENT_NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'CANNOT_RESOLVE';

export function disputeError(code: DisputeErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
