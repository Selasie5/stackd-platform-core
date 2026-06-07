export interface KycDocument {
  documentType: string;
  fileUrl: string;
  fileName?: string;
  note?: string;
}

export interface SubmitKycInput {
  documents: KycDocument[];
  schoolEmail?: string;
  applicantNote?: string;
}

export type KycReviewDecision = 'approved' | 'rejected' | 'needs_more_info';

export interface ReviewKycInput {
  applicationId: string;
  decision: KycReviewDecision;
  adminNote?: string;
  rejectionReason?: string;
}

export type KycStatus =
  | 'not_started'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'needs_more_info';
