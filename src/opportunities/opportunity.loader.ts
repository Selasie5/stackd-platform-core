import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { contests, cpmDeals, ugcOrders } from '@/db/schema/index';
import { opportunityError } from '@/opportunities/errors';
import type { OpportunityStatus, OpportunityType } from '@/opportunities/types';

export interface OpportunityRecord {
  id: string;
  brandId: string;
  status: OpportunityStatus;
  currency: 'NGN' | 'GHS' | 'USD';
  budgetAmount: string;
  reservedAt: Date | null;
  title: string;
}

export async function loadOpportunity(
  type: OpportunityType,
  id: string,
): Promise<OpportunityRecord> {
  if (type === 'UGC_ORDER') {
    const row = await db.query.ugcOrders.findFirst({
      where: and(eq(ugcOrders.id, id), isNull(ugcOrders.deletedAt)),
    });
    if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'UGC order not found');
    return {
      id: row.id,
      brandId: row.brandId,
      status: row.status as OpportunityStatus,
      currency: row.currency,
      budgetAmount: row.totalBudget,
      reservedAt: row.reservedAt,
      title: row.title,
    };
  }

  if (type === 'CPM_DEAL') {
    const row = await db.query.cpmDeals.findFirst({
      where: and(eq(cpmDeals.id, id), isNull(cpmDeals.deletedAt)),
    });
    if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'CPM deal not found');
    return {
      id: row.id,
      brandId: row.brandId,
      status: row.status as OpportunityStatus,
      currency: row.currency,
      budgetAmount: row.maxCampaignBudget,
      reservedAt: row.reservedAt,
      title: row.title,
    };
  }

  const row = await db.query.contests.findFirst({
    where: and(eq(contests.id, id), isNull(contests.deletedAt)),
  });
  if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'Contest not found');
  return {
    id: row.id,
    brandId: row.brandId,
    status: row.status as OpportunityStatus,
    currency: row.currency,
    budgetAmount: row.totalContestBudget,
    reservedAt: row.reservedAt,
    title: row.title,
  };
}
