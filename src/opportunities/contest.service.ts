import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  contestReferenceLinks,
  contestRewards,
  contests,
} from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import { opportunityError } from '@/opportunities/errors';
import type {
  ContestReferenceLinkInput,
  ContestRewardInput,
  OpportunityStatus,
} from '@/opportunities/types';

const currencySchema = z.enum(['NGN', 'GHS', 'USD']);
const videoTypeSchema = z.enum([
  'ugc',
  'testimonial',
  'unboxing',
  'tutorial',
  'lifestyle',
  'trending_audio',
  'skit',
  'review',
  'other',
]);
const targetPlatformSchema = z.enum(['tiktok', 'instagram', 'youtube_shorts', 'any']);
const usageRightsSchema = z.enum(['basic', 'ad', 'full']);

const referenceLinkSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
  isInspiration: z.boolean().optional(),
});

const rewardSchema = z.object({
  placement: z.number().int().positive(),
  label: z.string().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: currencySchema,
});

const contestInputSchema = z.object({
  title: z.string().min(1).max(255),
  productName: z.string().min(1).max(255),
  shortDescription: z.string().min(1).max(500),
  fullDescription: z.string().min(1),
  externalBriefLink: z.string().url().optional(),
  category: z.string().max(100).optional(),
  videoType: videoTypeSchema.optional(),
  videoLengthSeconds: z.number().int().positive().optional(),
  targetPlatform: targetPlatformSchema,
  requiredHashtags: z.string().optional(),
  requiredCaption: z.string().optional(),
  requiredBrandTag: z.string().max(255).optional(),
  postingRequired: z.boolean().optional(),
  contestRules: z.string().optional(),
  eligibilityRules: z.string().optional(),
  usageRightsPackage: usageRightsSchema,
  productDeliveryDetails: z.string().optional(),
  totalContestBudget: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: currencySchema,
  cpmBudget: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  payPer1000Views: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  maxPayableViewsPerCreator: z.number().int().positive().optional(),
  minimumWinners: z.number().int().positive().optional(),
  submissionDeadline: z.string().datetime(),
  winnerAnnouncementDate: z.string().datetime(),
  referenceLinks: z.array(referenceLinkSchema).optional(),
  rewards: z.array(rewardSchema).min(1),
});

type ContestRow = InferSelectModel<typeof contests> & {
  referenceLinks?: InferSelectModel<typeof contestReferenceLinks>[];
  rewards?: InferSelectModel<typeof contestRewards>[];
};

export function formatContest(row: ContestRow) {
  return {
    id: row.id,
    brandId: row.brandId,
    title: row.title,
    productName: row.productName,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    externalBriefLink: row.externalBriefLink,
    category: row.category,
    videoType: row.videoType,
    videoLengthSeconds: row.videoLengthSeconds,
    targetPlatform: row.targetPlatform,
    requiredHashtags: row.requiredHashtags,
    requiredCaption: row.requiredCaption,
    requiredBrandTag: row.requiredBrandTag,
    postingRequired: row.postingRequired,
    contestRules: row.contestRules,
    eligibilityRules: row.eligibilityRules,
    usageRightsPackage: row.usageRightsPackage,
    productDeliveryDetails: row.productDeliveryDetails,
    totalContestBudget: row.totalContestBudget,
    currency: row.currency,
    cpmBudget: row.cpmBudget,
    payPer1000Views: row.payPer1000Views,
    maxPayableViewsPerCreator: row.maxPayableViewsPerCreator,
    minimumWinners: row.minimumWinners,
    submissionDeadline: row.submissionDeadline.toISOString(),
    winnerAnnouncementDate: row.winnerAnnouncementDate.toISOString(),
    status: row.status,
    reservedAt: row.reservedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    referenceLinks: (row.referenceLinks ?? []).map((link) => ({
      id: link.id,
      url: link.url,
      label: link.label,
      isInspiration: link.isInspiration,
    })),
    rewards: (row.rewards ?? []).map((reward) => ({
      id: reward.id,
      placement: reward.placement,
      label: reward.label,
      amount: reward.amount,
      currency: reward.currency,
    })),
  };
}

export async function getContestById(id: string) {
  return db.query.contests.findFirst({
    where: and(eq(contests.id, id), isNull(contests.deletedAt)),
    with: { referenceLinks: true, rewards: true },
  });
}

async function insertReferenceLinks(contestId: string, links: ContestReferenceLinkInput[] = []) {
  if (links.length === 0) return;
  await db.insert(contestReferenceLinks).values(
    links.map((link) => ({
      contestId,
      url: link.url,
      label: link.label,
      isInspiration: link.isInspiration ?? false,
    })),
  );
}

async function insertRewards(contestId: string, rewards: ContestRewardInput[]) {
  await db.insert(contestRewards).values(
    rewards.map((reward) => ({
      contestId,
      placement: reward.placement,
      label: reward.label,
      amount: reward.amount,
      currency: reward.currency,
    })),
  );
}

async function replaceNestedData(
  contestId: string,
  links?: ContestReferenceLinkInput[],
  rewards?: ContestRewardInput[],
) {
  if (links) {
    await db.delete(contestReferenceLinks).where(eq(contestReferenceLinks.contestId, contestId));
    await insertReferenceLinks(contestId, links);
  }
  if (rewards) {
    await db.delete(contestRewards).where(eq(contestRewards.contestId, contestId));
    await insertRewards(contestId, rewards);
  }
}

export async function createContest(brandId: string, input: unknown) {
  const data = contestInputSchema.parse(input);

  const [contest] = await db
    .insert(contests)
    .values({
      brandId,
      title: data.title,
      productName: data.productName,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      externalBriefLink: data.externalBriefLink,
      category: data.category,
      videoType: data.videoType,
      videoLengthSeconds: data.videoLengthSeconds,
      targetPlatform: data.targetPlatform,
      requiredHashtags: data.requiredHashtags,
      requiredCaption: data.requiredCaption,
      requiredBrandTag: data.requiredBrandTag,
      postingRequired: data.postingRequired ?? false,
      contestRules: data.contestRules,
      eligibilityRules: data.eligibilityRules,
      usageRightsPackage: data.usageRightsPackage,
      productDeliveryDetails: data.productDeliveryDetails,
      totalContestBudget: data.totalContestBudget,
      currency: data.currency,
      cpmBudget: data.cpmBudget,
      payPer1000Views: data.payPer1000Views,
      maxPayableViewsPerCreator: data.maxPayableViewsPerCreator,
      minimumWinners: data.minimumWinners ?? 15,
      submissionDeadline: new Date(data.submissionDeadline),
      winnerAnnouncementDate: new Date(data.winnerAnnouncementDate),
      status: 'draft',
    })
    .returning();

  await insertReferenceLinks(contest.id, data.referenceLinks);
  await insertRewards(contest.id, data.rewards);

  const full = await getContestById(contest.id);
  return formatContest(full!);
}

export async function updateContest(brandId: string, id: string, input: unknown) {
  const existing = await getContestById(id);
  if (!existing) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'Contest not found');
  if (existing.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  if (existing.status !== 'draft') {
    throw opportunityError('INVALID_STATUS', 'Only draft opportunities can be updated');
  }

  const data = contestInputSchema.parse(input);

  await db
    .update(contests)
    .set({
      title: data.title,
      productName: data.productName,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      externalBriefLink: data.externalBriefLink,
      category: data.category,
      videoType: data.videoType,
      videoLengthSeconds: data.videoLengthSeconds,
      targetPlatform: data.targetPlatform,
      requiredHashtags: data.requiredHashtags,
      requiredCaption: data.requiredCaption,
      requiredBrandTag: data.requiredBrandTag,
      postingRequired: data.postingRequired ?? false,
      contestRules: data.contestRules,
      eligibilityRules: data.eligibilityRules,
      usageRightsPackage: data.usageRightsPackage,
      productDeliveryDetails: data.productDeliveryDetails,
      totalContestBudget: data.totalContestBudget,
      currency: data.currency,
      cpmBudget: data.cpmBudget,
      payPer1000Views: data.payPer1000Views,
      maxPayableViewsPerCreator: data.maxPayableViewsPerCreator,
      minimumWinners: data.minimumWinners ?? 15,
      submissionDeadline: new Date(data.submissionDeadline),
      winnerAnnouncementDate: new Date(data.winnerAnnouncementDate),
      updatedAt: new Date(),
    })
    .where(eq(contests.id, id));

  await replaceNestedData(id, data.referenceLinks, data.rewards);

  const full = await getContestById(id);
  return formatContest(full!);
}

export async function deleteContest(brandId: string, id: string) {
  const existing = await getContestById(id);
  if (!existing) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'Contest not found');
  if (existing.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  if (existing.status !== 'draft') {
    throw opportunityError('INVALID_STATUS', 'Only draft opportunities can be deleted');
  }

  await db
    .update(contests)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(contests.id, id));

  return true;
}

export async function getContestForSession(
  brandId: string | undefined,
  isAdmin: boolean,
  id: string,
) {
  const row = await getContestById(id);
  if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'Contest not found');
  if (!isAdmin && row.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  return formatContest(row);
}

export async function listMyContests(brandId: string, status?: OpportunityStatus) {
  const conditions = [eq(contests.brandId, brandId), isNull(contests.deletedAt)];
  if (status) {
    conditions.push(eq(contests.status, status));
  }

  const rows = await db.query.contests.findMany({
    where: and(...conditions),
    with: { referenceLinks: true, rewards: true },
    orderBy: [desc(contests.createdAt)],
  });

  return rows.map(formatContest);
}
