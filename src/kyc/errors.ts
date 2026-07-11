import { GraphQLError } from 'graphql';

export type KycErrorCode =
  | 'KYC_NOT_APPROVED'
  | 'KYC_ALREADY_PENDING'
  | 'KYC_ALREADY_APPROVED'
  | 'KYC_NOT_FOUND'
  | 'KYC_INVALID_DOCUMENTS';

export function kycError(code: KycErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
