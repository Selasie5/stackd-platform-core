import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { contests, cpmDeals, ugcOrders } from '@/db/schema/index';
import { formatContest } from '@/opportunities/contest.service';
import { formatCpmDeal } from '@/opportunities/cpm.service';
import { formatUgcOrder } from '@/opportunities/ugc.service';

export async function listLiveUgcOrders() {
  const rows = await db.query.ugcOrders.findMany({
    where: and(
      eq(ugcOrders.status, 'live'),
      isNull(ugcOrders.deletedAt),
      gt(ugcOrders.deadline, new Date()),
    ),
  });
  return rows.map(formatUgcOrder);
}

export async function listLiveCpmDeals() {
  const rows = await db.query.cpmDeals.findMany({
    where: and(
      eq(cpmDeals.status, 'live'),
      isNull(cpmDeals.deletedAt),
      gt(cpmDeals.postingDeadline, new Date()),
    ),
  });
  return rows.map(formatCpmDeal);
}

export async function listLiveContests() {
  const rows = await db.query.contests.findMany({
    where: and(
      eq(contests.status, 'live'),
      isNull(contests.deletedAt),
      gt(contests.submissionDeadline, new Date()),
    ),
    with: { rewards: true, referenceLinks: true },
  });
  return rows.map(formatContest);
}
