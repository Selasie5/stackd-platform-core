import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { ugcOrderReferenceLinks, ugcOrders } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import { opportunityError } from '@/opportunities/errors';
import type { OpportunityStatus, ReferenceLinkInput } from '@/opportunities/types';

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
});

const ugcOrderInputSchema = z.object({
  title: z.string().min(1).max(255),
  productName: z.string().min(1).max(255),
  shortDescription: z.string().min(1).max(500),
  fullDescription: z.string().min(1),
  externalBriefLink: z.string().url().optional(),
  videoType: videoTypeSchema,
  videoLengthSeconds: z.number().int().positive(),
  numberOfCreators: z.number().int().positive(),
  flatRatePerCreator: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: currencySchema,
  totalBudget: z.string().regex(/^\d+(\.\d{1,2})?$/),
  requiredShots: z.string().optional(),
  wordsToSay: z.string().optional(),
  wordsToAvoid: z.string().optional(),
  callToAction: z.string().max(255).optional(),
  usageRightsPackage: usageRightsSchema,
  postingRequired: z.boolean().optional(),
  targetPlatform: targetPlatformSchema.optional(),
  productDeliveryDetails: z.string().optional(),
  revisionLimit: z.number().int().min(0).optional(),
  deadline: z.string().datetime(),
  referenceLinks: z.array(referenceLinkSchema).optional(),
});

type UgcOrderRow = InferSelectModel<typeof ugcOrders> & {
  referenceLinks?: InferSelectModel<typeof ugcOrderReferenceLinks>[];
};

export function formatUgcOrder(row: UgcOrderRow) {
  return {
    id: row.id,
    brandId: row.brandId,
    title: row.title,
    productName: row.productName,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    externalBriefLink: row.externalBriefLink,
    videoType: row.videoType,
    videoLengthSeconds: row.videoLengthSeconds,
    numberOfCreators: row.numberOfCreators,
    flatRatePerCreator: row.flatRatePerCreator,
    currency: row.currency,
    totalBudget: row.totalBudget,
    requiredShots: row.requiredShots,
    wordsToSay: row.wordsToSay,
    wordsToAvoid: row.wordsToAvoid,
    callToAction: row.callToAction,
    usageRightsPackage: row.usageRightsPackage,
    postingRequired: row.postingRequired,
    targetPlatform: row.targetPlatform,
    productDeliveryDetails: row.productDeliveryDetails,
    revisionLimit: row.revisionLimit,
    deadline: row.deadline.toISOString(),
    status: row.status,
    reservedAt: row.reservedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    referenceLinks: (row.referenceLinks ?? []).map((link) => ({
      id: link.id,
      url: link.url,
      label: link.label,
    })),
  };
}

export async function getUgcOrderById(id: string) {
  return db.query.ugcOrders.findFirst({
    where: and(eq(ugcOrders.id, id), isNull(ugcOrders.deletedAt)),
    with: { referenceLinks: true },
  });
}

async function insertReferenceLinks(ugcOrderId: string, links: ReferenceLinkInput[] = []) {
  if (links.length === 0) return;
  await db.insert(ugcOrderReferenceLinks).values(
    links.map((link) => ({
      ugcOrderId,
      url: link.url,
      label: link.label,
    })),
  );
}

async function replaceReferenceLinks(ugcOrderId: string, links: ReferenceLinkInput[] = []) {
  await db.delete(ugcOrderReferenceLinks).where(eq(ugcOrderReferenceLinks.ugcOrderId, ugcOrderId));
  await insertReferenceLinks(ugcOrderId, links);
}

export async function createUgcOrder(brandId: string, input: unknown) {
  const data = ugcOrderInputSchema.parse(input);

  const [order] = await db
    .insert(ugcOrders)
    .values({
      brandId,
      title: data.title,
      productName: data.productName,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      externalBriefLink: data.externalBriefLink,
      videoType: data.videoType,
      videoLengthSeconds: data.videoLengthSeconds,
      numberOfCreators: data.numberOfCreators,
      flatRatePerCreator: data.flatRatePerCreator,
      currency: data.currency,
      totalBudget: data.totalBudget,
      requiredShots: data.requiredShots,
      wordsToSay: data.wordsToSay,
      wordsToAvoid: data.wordsToAvoid,
      callToAction: data.callToAction,
      usageRightsPackage: data.usageRightsPackage,
      postingRequired: data.postingRequired ?? false,
      targetPlatform: data.targetPlatform,
      productDeliveryDetails: data.productDeliveryDetails,
      revisionLimit: data.revisionLimit ?? 1,
      deadline: new Date(data.deadline),
      status: 'draft',
    })
    .returning();

  await insertReferenceLinks(order.id, data.referenceLinks);

  const full = await getUgcOrderById(order.id);
  return formatUgcOrder(full!);
}

export async function updateUgcOrder(brandId: string, id: string, input: unknown) {
  const existing = await getUgcOrderById(id);
  if (!existing) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'UGC order not found');
  if (existing.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  if (existing.status !== 'draft') {
    throw opportunityError('INVALID_STATUS', 'Only draft opportunities can be updated');
  }

  const data = ugcOrderInputSchema.parse(input);

  await db
    .update(ugcOrders)
    .set({
      title: data.title,
      productName: data.productName,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      externalBriefLink: data.externalBriefLink,
      videoType: data.videoType,
      videoLengthSeconds: data.videoLengthSeconds,
      numberOfCreators: data.numberOfCreators,
      flatRatePerCreator: data.flatRatePerCreator,
      currency: data.currency,
      totalBudget: data.totalBudget,
      requiredShots: data.requiredShots,
      wordsToSay: data.wordsToSay,
      wordsToAvoid: data.wordsToAvoid,
      callToAction: data.callToAction,
      usageRightsPackage: data.usageRightsPackage,
      postingRequired: data.postingRequired ?? false,
      targetPlatform: data.targetPlatform,
      productDeliveryDetails: data.productDeliveryDetails,
      revisionLimit: data.revisionLimit ?? 1,
      deadline: new Date(data.deadline),
      updatedAt: new Date(),
    })
    .where(eq(ugcOrders.id, id));

  if (data.referenceLinks) {
    await replaceReferenceLinks(id, data.referenceLinks);
  }

  const full = await getUgcOrderById(id);
  return formatUgcOrder(full!);
}

export async function deleteUgcOrder(brandId: string, id: string) {
  const existing = await getUgcOrderById(id);
  if (!existing) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'UGC order not found');
  if (existing.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  if (existing.status !== 'draft') {
    throw opportunityError('INVALID_STATUS', 'Only draft opportunities can be deleted');
  }

  await db
    .update(ugcOrders)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(ugcOrders.id, id));

  return true;
}

export async function getUgcOrderForSession(
  brandId: string | undefined,
  isAdmin: boolean,
  id: string,
) {
  const row = await getUgcOrderById(id);
  if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'UGC order not found');
  if (!isAdmin && row.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  return formatUgcOrder(row);
}

export async function listMyUgcOrders(brandId: string, status?: OpportunityStatus) {
  const conditions = [eq(ugcOrders.brandId, brandId), isNull(ugcOrders.deletedAt)];
  if (status) {
    conditions.push(eq(ugcOrders.status, status));
  }

  const rows = await db.query.ugcOrders.findMany({
    where: and(...conditions),
    with: { referenceLinks: true },
    orderBy: [desc(ugcOrders.createdAt)],
  });

  return rows.map(formatUgcOrder);
}
