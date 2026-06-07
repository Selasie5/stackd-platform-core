import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  brands,
  contests,
  cpmDeals,
  notifications,
  ugcOrders,
} from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { opportunityError } from '@/opportunities/errors';
import { finalizeSpend, releaseFunds, reserveFunds } from '@/opportunities/wallet.service';
import {
  getTargetStatus,
  LAUNCH_NOTIFICATION_TYPE,
  OPPORTUNITY_REFERENCE_TYPE,
  type LifecycleAction,
  type OpportunityStatus,
  type OpportunityType,
  type ReviewDecision,
} from '@/opportunities/types';
import { formatContest, getContestById } from '@/opportunities/contest.service';
import { formatCpmDeal, getCpmDealById } from '@/opportunities/cpm.service';
import { formatUgcOrder, getUgcOrderById } from '@/opportunities/ugc.service';

interface OpportunityRecord {
  id: string;
  brandId: string;
  status: OpportunityStatus;
  currency: 'NGN' | 'GHS' | 'USD';
  budgetAmount: string;
  reservedAt: Date | null;
  title: string;
}

async function loadOpportunity(type: OpportunityType, id: string): Promise<OpportunityRecord> {
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

export function assertBrandOwnsOpportunity(
  session: SessionData,
  brandId: string,
  allowAdmin = false,
): void {
  if (allowAdmin && session.role === 'admin') return;
  if (session.role !== 'brand' || session.brandId !== brandId) {
    throw opportunityError('FORBIDDEN', 'You do not have access to this opportunity');
  }
}

async function updateOpportunityStatus(
  type: OpportunityType,
  id: string,
  status: OpportunityStatus,
  extra: { reservedAt?: Date | null; completedAt?: Date | null } = {},
): Promise<void> {
  const values = { status, updatedAt: new Date(), ...extra };

  if (type === 'UGC_ORDER') {
    await db.update(ugcOrders).set(values).where(eq(ugcOrders.id, id));
    return;
  }
  if (type === 'CPM_DEAL') {
    await db.update(cpmDeals).set(values).where(eq(cpmDeals.id, id));
    return;
  }
  await db.update(contests).set(values).where(eq(contests.id, id));
}

async function createLaunchNotification(
  brandId: string,
  type: OpportunityType,
  opportunityId: string,
  title: string,
): Promise<void> {
  const brand = await db.query.brands.findFirst({
    where: eq(brands.id, brandId),
  });
  if (!brand) return;

  await db.insert(notifications).values({
    userId: brand.userId,
    type: LAUNCH_NOTIFICATION_TYPE[type],
    title: 'Campaign launched',
    body: `Your campaign "${title}" is now live.`,
    referenceType: OPPORTUNITY_REFERENCE_TYPE[type],
    referenceId: opportunityId,
  });
}

async function formatOpportunity(type: OpportunityType, id: string) {
  if (type === 'UGC_ORDER') {
    const row = await getUgcOrderById(id);
    if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'UGC order not found');
    return { __typename: 'UgcOrder' as const, ...formatUgcOrder(row) };
  }
  if (type === 'CPM_DEAL') {
    const row = await getCpmDealById(id);
    if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'CPM deal not found');
    return { __typename: 'CpmDeal' as const, ...formatCpmDeal(row) };
  }
  const row = await getContestById(id);
  if (!row) throw opportunityError('OPPORTUNITY_NOT_FOUND', 'Contest not found');
  return { __typename: 'Contest' as const, ...formatContest(row) };
}

function assertTransition(action: LifecycleAction, from: OpportunityStatus): OpportunityStatus {
  try {
    return getTargetStatus(action, from);
  } catch {
    throw opportunityError('INVALID_STATUS', `Cannot ${action} opportunity in status ${from}`);
  }
}

async function applyTransition(
  session: SessionData,
  type: OpportunityType,
  id: string,
  action: LifecycleAction,
  options: { allowAdmin?: boolean; requireOwner?: boolean } = {},
): Promise<ReturnType<typeof formatOpportunity>> {
  const record = await loadOpportunity(type, id);

  if (options.requireOwner !== false) {
    assertBrandOwnsOpportunity(session, record.brandId, options.allowAdmin);
  }

  const nextStatus = assertTransition(action, record.status);
  const reference = {
    referenceType: OPPORTUNITY_REFERENCE_TYPE[type],
    referenceId: record.id,
    description: `${action} ${record.title}`,
  };

  if (action === 'approve') {
    await reserveFunds(record.brandId, record.budgetAmount, record.currency, reference);
    await updateOpportunityStatus(type, id, nextStatus, { reservedAt: new Date() });
    await createLaunchNotification(record.brandId, type, id, record.title);
    return formatOpportunity(type, id);
  }

  if (action === 'cancel' && record.reservedAt) {
    await releaseFunds(record.brandId, record.budgetAmount, record.currency, reference);
  }

  if (action === 'complete') {
    await finalizeSpend(record.brandId, record.budgetAmount, record.currency, reference);
    await updateOpportunityStatus(type, id, nextStatus, { completedAt: new Date() });
    return formatOpportunity(type, id);
  }

  await updateOpportunityStatus(type, id, nextStatus);
  return formatOpportunity(type, id);
}

export async function submitOpportunityForApproval(
  session: SessionData,
  type: OpportunityType,
  id: string,
) {
  return applyTransition(session, type, id, 'submit');
}

export async function reviewOpportunity(
  session: SessionData,
  input: { type: OpportunityType; id: string; decision: ReviewDecision; adminNote?: string },
) {
  const record = await loadOpportunity(input.type, input.id);

  if (input.decision === 'approved') {
    return applyTransition(session, input.type, input.id, 'approve', {
      allowAdmin: true,
      requireOwner: false,
    });
  }

  assertTransition('reject', record.status);
  await updateOpportunityStatus(input.type, input.id, 'draft');
  return formatOpportunity(input.type, input.id);
}

export async function pauseOpportunity(session: SessionData, type: OpportunityType, id: string) {
  return applyTransition(session, type, id, 'pause');
}

export async function resumeOpportunity(session: SessionData, type: OpportunityType, id: string) {
  return applyTransition(session, type, id, 'resume');
}

export async function closeOpportunity(session: SessionData, type: OpportunityType, id: string) {
  return applyTransition(session, type, id, 'close');
}

export async function cancelOpportunity(session: SessionData, type: OpportunityType, id: string) {
  return applyTransition(session, type, id, 'cancel');
}

export async function completeOpportunity(
  session: SessionData,
  type: OpportunityType,
  id: string,
) {
  const record = await loadOpportunity(type, id);
  assertBrandOwnsOpportunity(session, record.brandId, true);

  return applyTransition(session, type, id, 'complete', { allowAdmin: true });
}

export async function listPendingOpportunities(type?: OpportunityType) {
  const results: Awaited<ReturnType<typeof formatOpportunity>>[] = [];

  if (!type || type === 'UGC_ORDER') {
    const rows = await db.query.ugcOrders.findMany({
      where: and(eq(ugcOrders.status, 'pending_approval'), isNull(ugcOrders.deletedAt)),
    });
    for (const row of rows) {
      results.push({ __typename: 'UgcOrder', ...formatUgcOrder(row) });
    }
  }

  if (!type || type === 'CPM_DEAL') {
    const rows = await db.query.cpmDeals.findMany({
      where: and(eq(cpmDeals.status, 'pending_approval'), isNull(cpmDeals.deletedAt)),
    });
    for (const row of rows) {
      results.push({ __typename: 'CpmDeal', ...formatCpmDeal(row) });
    }
  }

  if (!type || type === 'CONTEST') {
    const rows = await db.query.contests.findMany({
      where: and(eq(contests.status, 'pending_approval'), isNull(contests.deletedAt)),
    });
    for (const row of rows) {
      results.push({ __typename: 'Contest', ...formatContest(row) });
    }
  }

  return results;
}

export { loadOpportunity };
export { assertValidTransitionForTest } from '@/opportunities/lifecycle.helpers';
