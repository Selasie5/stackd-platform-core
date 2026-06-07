import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  brandWallets,
  brands,
  creators,
  kycApplications,
  notifications,
} from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import { kycError } from '@/kyc/errors';
import type { KycReviewDecision, SubmitKycInput } from '@/kyc/types';
import type { SessionData, UserRole } from '@/auth/types';

const submitKycSchema = z.object({
  documents: z
    .array(
      z.object({
        documentType: z.string().min(1),
        fileUrl: z.string().url(),
        fileName: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .min(1),
  schoolEmail: z.string().email().optional(),
  applicantNote: z.string().optional(),
});

const reviewKycSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'needs_more_info']),
  adminNote: z.string().optional(),
  rejectionReason: z.string().optional(),
});

type KycApplicationRow = InferSelectModel<typeof kycApplications>;

export function formatKycApplication(row: KycApplicationRow) {
  return {
    id: row.id,
    status: row.status,
    attemptNumber: row.attemptNumber,
    profileType: row.profileType,
    documents: row.documents,
    schoolEmail: row.schoolEmail,
    applicantNote: row.applicantNote,
    adminNote: row.adminNote,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

async function getProfileKycStatus(session: SessionData): Promise<{
  kycStatus: string;
  brandId?: string;
  creatorId?: string;
}> {
  if (session.role === 'brand' && session.brandId) {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, session.brandId),
    });
    if (!brand) throw kycError('KYC_NOT_FOUND', 'Brand profile not found');
    return { kycStatus: brand.kycStatus, brandId: brand.id };
  }

  if (session.role === 'creator' && session.creatorId) {
    const creator = await db.query.creators.findFirst({
      where: eq(creators.id, session.creatorId),
    });
    if (!creator) throw kycError('KYC_NOT_FOUND', 'Creator profile not found');
    return { kycStatus: creator.kycStatus, creatorId: creator.id };
  }

  throw kycError('KYC_NOT_FOUND', 'No KYC profile found for this account');
}

async function createNotification(
  userId: string,
  type: 'kyc_submitted' | 'kyc_approved' | 'kyc_rejected' | 'kyc_needs_more_info',
  title: string,
  body: string,
  referenceId: string,
) {
  await db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    referenceType: 'kyc_application',
    referenceId,
  });
}

export async function getKycStatusForUser(userId: string, role: UserRole): Promise<string> {
  if (role === 'brand') {
    const brand = await db.query.brands.findFirst({ where: eq(brands.userId, userId) });
    return brand?.kycStatus ?? 'not_started';
  }
  if (role === 'creator') {
    const creator = await db.query.creators.findFirst({ where: eq(creators.userId, userId) });
    return creator?.kycStatus ?? 'not_started';
  }
  return 'approved';
}

export async function submitKyc(userId: string, role: UserRole, input: unknown) {
  if (role !== 'brand' && role !== 'creator') {
    throw kycError('KYC_NOT_FOUND', 'Only brands and creators can submit KYC');
  }

  const data = submitKycSchema.parse(input) as SubmitKycInput;

  const brand =
    role === 'brand'
      ? await db.query.brands.findFirst({ where: eq(brands.userId, userId) })
      : null;
  const creator =
    role === 'creator'
      ? await db.query.creators.findFirst({ where: eq(creators.userId, userId) })
      : null;

  if (role === 'brand' && !brand) throw kycError('KYC_NOT_FOUND', 'Brand profile not found');
  if (role === 'creator' && !creator) throw kycError('KYC_NOT_FOUND', 'Creator profile not found');

  const currentStatus = role === 'brand' ? brand!.kycStatus : creator!.kycStatus;

  if (currentStatus === 'pending_review') {
    throw kycError('KYC_ALREADY_PENDING', 'A KYC application is already under review');
  }
  if (currentStatus === 'approved') {
    throw kycError('KYC_ALREADY_APPROVED', 'Your account is already KYC verified');
  }

  const currentApplication = await db.query.kycApplications.findFirst({
    where: and(
      eq(kycApplications.userId, userId),
      eq(kycApplications.isCurrent, true),
    ),
  });

  const attemptNumber = currentApplication ? currentApplication.attemptNumber + 1 : 1;

  if (currentApplication) {
    await db
      .update(kycApplications)
      .set({ isCurrent: false })
      .where(eq(kycApplications.id, currentApplication.id));
  }

  const [application] = await db
    .insert(kycApplications)
    .values({
      userId,
      profileType: role,
      brandId: brand?.id,
      creatorId: creator?.id,
      attemptNumber,
      isCurrent: true,
      status: 'pending_review',
      documents: data.documents,
      schoolEmail: role === 'creator' ? data.schoolEmail : undefined,
      applicantNote: data.applicantNote,
    })
    .returning();

  if (role === 'brand') {
    await db
      .update(brands)
      .set({ kycStatus: 'pending_review' })
      .where(eq(brands.id, brand!.id));
  } else {
    await db
      .update(creators)
      .set({ kycStatus: 'pending_review' })
      .where(eq(creators.id, creator!.id));
  }

  await createNotification(
    userId,
    'kyc_submitted',
    'KYC submitted',
    'Your verification documents have been submitted and are under review.',
    application.id,
  );

  return formatKycApplication(application);
}

export async function getMyKycApplication(userId: string) {
  const application = await db.query.kycApplications.findFirst({
    where: and(eq(kycApplications.userId, userId), eq(kycApplications.isCurrent, true)),
    orderBy: desc(kycApplications.createdAt),
  });

  return application ? formatKycApplication(application) : null;
}

export async function listPendingKycApplications() {
  const rows = await db.query.kycApplications.findMany({
    where: eq(kycApplications.status, 'pending_review'),
    orderBy: desc(kycApplications.submittedAt),
  });

  return rows.map(formatKycApplication);
}

export async function reviewKyc(adminUserId: string, input: unknown) {
  const data = reviewKycSchema.parse(input);
  const decision = data.decision as KycReviewDecision;

  const application = await db.query.kycApplications.findFirst({
    where: eq(kycApplications.id, data.applicationId),
  });

  if (!application) {
    throw kycError('KYC_NOT_FOUND', 'KYC application not found');
  }

  if (application.status !== 'pending_review') {
    throw kycError('KYC_NOT_FOUND', 'This application is not pending review');
  }

  const now = new Date();
  let newStatus: 'approved' | 'rejected' | 'needs_more_info';

  if (decision === 'approved') {
    newStatus = 'approved';
  } else if (decision === 'rejected') {
    newStatus = 'rejected';
  } else {
    newStatus = 'needs_more_info';
  }

  const [updated] = await db
    .update(kycApplications)
    .set({
      status: newStatus,
      reviewedBy: adminUserId,
      reviewedAt: now,
      adminNote: data.adminNote,
      rejectionReason: data.rejectionReason,
    })
    .where(eq(kycApplications.id, application.id))
    .returning();

  if (application.profileType === 'brand' && application.brandId) {
    await db
      .update(brands)
      .set({
        kycStatus: newStatus,
        kycApprovedAt: decision === 'approved' ? now : null,
      })
      .where(eq(brands.id, application.brandId));

    if (decision === 'approved') {
      await db
        .update(brandWallets)
        .set({ status: 'active' })
        .where(eq(brandWallets.brandId, application.brandId));
    }
  }

  if (application.profileType === 'creator' && application.creatorId) {
    await db
      .update(creators)
      .set({
        kycStatus: newStatus,
        kycApprovedAt: decision === 'approved' ? now : null,
      })
      .where(eq(creators.id, application.creatorId));
  }

  const notificationMap = {
    approved: {
      type: 'kyc_approved' as const,
      title: 'KYC approved',
      body: 'Your identity verification has been approved. You now have full platform access.',
    },
    rejected: {
      type: 'kyc_rejected' as const,
      title: 'KYC rejected',
      body: data.rejectionReason ?? 'Your verification was rejected. You may resubmit with corrected documents.',
    },
    needs_more_info: {
      type: 'kyc_needs_more_info' as const,
      title: 'More information required',
      body: data.adminNote ?? 'Please provide additional documents for your verification.',
    },
  };

  const notif = notificationMap[decision];
  await createNotification(
    application.userId,
    notif.type,
    notif.title,
    notif.body,
    application.id,
  );

  return formatKycApplication(updated);
}

export { getProfileKycStatus };
