import { GraphQLError } from 'graphql/index.js';

export type OpportunityErrorCode =
  | 'OPPORTUNITY_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'INSUFFICIENT_WALLET_BALANCE'
  | 'WALLET_FROZEN'
  | 'FORBIDDEN'
  | 'WALLET_NOT_FOUND';

export function opportunityError(code: OpportunityErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
