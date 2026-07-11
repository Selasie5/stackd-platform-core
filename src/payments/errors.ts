import { GraphQLError } from 'graphql/index.js';

export type PaymentErrorCode =
  | 'MOOLRE_NOT_CONFIGURED'
  | 'PAYSTACK_NOT_CONFIGURED'
  | 'INVALID_AMOUNT'
  | 'WALLET_FROZEN'
  | 'WALLET_NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'PAYMENT_DETAILS_REQUIRED'
  | 'WITHDRAWAL_IN_PROGRESS'
  | 'WITHDRAWAL_NOT_FOUND'
  | 'TOP_UP_NOT_FOUND'
  | 'TOP_UP_ALREADY_PROCESSED'
  | 'ESCROW_ALREADY_ALLOCATED'
  | 'FORBIDDEN';

export function paymentError(code: PaymentErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
