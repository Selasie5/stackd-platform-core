export type UserRole = 'admin' | 'brand' | 'creator';

export interface SessionData {
  userId: string;
  role: UserRole;
  email: string;
  emailVerified: boolean;
  brandId?: string;
  creatorId?: string;
}

export interface EmailVerificationPayload {
  userId: string;
  email: string;
}
