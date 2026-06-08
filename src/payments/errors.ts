import { GraphQLError } from 'graphql';

export type PaymentErrorCode =
  | 'PAYSTACK_NOT_CONFIGURED'
  | 'INVALID_AMOUNT'
  | 'WALLET_FROZEN'
  | 'WALLET_NOT_FOUND'
  | 'TOP_UP_NOT_FOUND'
  | 'TOP_UP_ALREADY_PROCESSED';

export function paymentError(code: PaymentErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
