import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { cpmDealReferenceLinks, cpmDeals } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import { opportunityError } from '@/opportunities/errors';
import type { OpportunityStatus, ReferenceLinkInput } from '@/opportunities/types';

const currencySchema = z.enum(['NGN', 'GHS', 'USD']);
const targetPlatformSchema = z.enum(['tiktok', 'instagram', 'youtube_shorts', 'any']);
const usageRightsSchema = z.enum(['basic', 'ad', 'full']);

const referenceLinkSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
});

const cpmDealInputSchema = z.object({
  title: z.string().min(1).max(255),
  productName: z.string().min(1).max(255),
  shortDescription: z.string().min(1).max(500),
  fullDescription: z.string().min(1),
  externalBriefLink: z.string().url().optional(),
  targetPlatform: targetPlatformSchema,
  requiredHashtags: z.string().optional(),
  requiredCaption: z.string().optional(),
  requiredBrandTag: z.string().max(255).optional(),
  payPer1000Views: z.string().regex(/^\d+(\.\d{1,2})?$/),
  maxPayableViewsPerCreator: z.number().int().positive(),
  numberOfCreators: z.number().int().positive(),
  maxCampaignBudget: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: currencySchema,
  usageRightsPackage: usageRightsSchema,
  productDeliveryDetails: z.string().optional(),
  postingDeadline: z.string().datetime(),
  finalViewCountDeadline: z.string().datetime(),
  referenceLinks: z.array(referenceLinkSchema).optional(),
});

type CpmDealRow = InferSelectModel<typeof cpmDeals> & {
  referenceLinks?: InferSelectModel<typeof cpmDealReferenceLinks>[];
};

export function formatCpmDeal(row: CpmDealRow) {
  return {
    id: row.id,
    brandId: row.brandId,
    title: row.title,
    productName: row.productName,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    externalBriefLink: row.externalBriefLink,
    targetPlatform: row.targetPlatform,
    requiredHashtags: row.requiredHashtags,
    requiredCaption: row.requiredCaption,
    requiredBrandTag: row.requiredBrandTag,
    payPer1000Views: row.payPer1000Views,
    maxPayableViewsPerCreator: row.maxPayableViewsPerCreator,
    numberOfCreators: row.numberOfCreators,
    maxCampaignBudget: row.maxCampaignBudget,
    currency: row.currency,
    usageRightsPackage: row.usageRightsPackage,
    productDeliveryDetails: row.productDeliveryDetails,
    postingDeadline: row.postingDeadline.toISOString(),
    finalViewCountDeadline: row.finalViewCountDeadline.toISOString(),
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

export async function getCpmDealById(id: string) {
  return db.query.cpmDeals.findFirst({
    where: and(eq(cpmDeals.id, id), isNull(cpmDeals.deletedAt)),
    with: { referenceLinks: true },
  });
}

async function insertReferenceLinks(cpmDealId: string, links: ReferenceLinkInput[] = []) {
  if (links.length === 0) return;
  await db.insert(cpmDealReferenceLinks).values(
    links.map((link) => ({
      cpmDealId,
      url: link.url,
      label: link.label,
    })),
  );
}

async function replaceReferenceLinks(cpmDealId: string, links: ReferenceLinkInput[] = []) {
  await db.delete(cpmDealReferenceLinks).where(eq(cpmDealReferenceLinks.cpmDealId, cpmDealId));
  await insertReferenceLinks(cpmDealId, links);
}

export async function createCpmDeal(brandId: string, input: unknown) {
  const data = cpmDealInputSchema.parse(input);

  const [deal] = await db
    .insert(cpmDeals)
    .values({
      brandId,
      title: data.title,
      productName: data.productName,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      externalBriefLink: data.externalBriefLink,
      targetPlatform: data.targetPlatform,
      requiredHashtags: data.requiredHashtags,
      requiredCaption: data.requiredCaption,
      requiredBrandTag: data.requiredBrandTag,
      payPer1000Views: data.payPer1000Views,
      maxPayableViewsPerCreator: data.maxPayableViewsPerCreator,
      numberOfCreators: data.numberOfCreators,
      maxCampaignBudget: data.maxCampaignBudget,
      currency: data.currency,
      usageRightsPackage: data.usageRightsPackage,
      productDeliveryDetails: data.productDeliveryDetails,
      postingDeadline: new Date(data.postingDeadline),
      finalViewCountDeadline: new Date(data.finalViewCountDeadline),
      status: 'draft',
    })
    .returning();

  await insertReferenceLinks(deal.id, data.referenceLinks);

  const full = await getCpmDealById(deal.id);
  return formatCpmDeal(full!);
}

export async function updateCpmDeal(brandId: string, id: string, input: unknown) {
  const existing = await getCpmDealById(id);
  if (!existing) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'CPM deal not found');
  if (existing.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  if (existing.status !== 'draft') {
    throw opportunityError('INVALID_STATUS', 'Only draft opportunities can be updated');
  }

  const data = cpmDealInputSchema.parse(input);

  await db
    .update(cpmDeals)
    .set({
      title: data.title,
      productName: data.productName,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      externalBriefLink: data.externalBriefLink,
      targetPlatform: data.targetPlatform,
      requiredHashtags: data.requiredHashtags,
      requiredCaption: data.requiredCaption,
      requiredBrandTag: data.requiredBrandTag,
      payPer1000Views: data.payPer1000Views,
      maxPayableViewsPerCreator: data.maxPayableViewsPerCreator,
      numberOfCreators: data.numberOfCreators,
      maxCampaignBudget: data.maxCampaignBudget,
      currency: data.currency,
      usageRightsPackage: data.usageRightsPackage,
      productDeliveryDetails: data.productDeliveryDetails,
      postingDeadline: new Date(data.postingDeadline),
      finalViewCountDeadline: new Date(data.finalViewCountDeadline),
      updatedAt: new Date(),
    })
    .where(eq(cpmDeals.id, id));

  if (data.referenceLinks) {
    await replaceReferenceLinks(id, data.referenceLinks);
  }

  const full = await getCpmDealById(id);
  return formatCpmDeal(full!);
}

export async function deleteCpmDeal(brandId: string, id: string) {
  const existing = await getCpmDealById(id);
  if (!existing) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'CPM deal not found');
  if (existing.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  if (existing.status !== 'draft') {
    throw opportunityError('INVALID_STATUS', 'Only draft opportunities can be deleted');
  }

  await db
    .update(cpmDeals)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(cpmDeals.id, id));

  return true;
}

export async function getCpmDealForSession(
  brandId: string | undefined,
  isAdmin: boolean,
  id: string,
) {
  const row = await getCpmDealById(id);
  if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'CPM deal not found');
  if (!isAdmin && row.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
  return formatCpmDeal(row);
}

export async function listMyCpmDeals(brandId: string, status?: OpportunityStatus) {
  const conditions = [eq(cpmDeals.brandId, brandId), isNull(cpmDeals.deletedAt)];
  if (status) {
    conditions.push(eq(cpmDeals.status, status));
  }

  const rows = await db.query.cpmDeals.findMany({
    where: and(...conditions),
    with: { referenceLinks: true },
    orderBy: [desc(cpmDeals.createdAt)],
  });

  return rows.map(formatCpmDeal);
}
