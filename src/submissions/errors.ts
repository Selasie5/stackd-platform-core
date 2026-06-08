import { GraphQLError } from 'graphql';

export type SubmissionErrorCode =
  | 'SUBMISSION_NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS'
  | 'DUPLICATE_SUBMISSION'
  | 'DEADLINE_PASSED'
  | 'REVISION_LIMIT_REACHED'
  | 'SLOT_LIMIT_REACHED'
  | 'OPPORTUNITY_NOT_LIVE';

export function submissionError(code: SubmissionErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}
