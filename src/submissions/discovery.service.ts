import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { contestSubmissions, contests, cpmDeals, ugcOrders } from '@/db/schema/index';
import { formatContest } from '@/opportunities/contest.service';
import { formatCpmDeal } from '@/opportunities/cpm.service';
import { opportunityError } from '@/opportunities/errors';
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

const CREATOR_VISIBLE_CONTEST_STATUSES = new Set(['live', 'paused', 'closed', 'completed']);

export async function getContestForCreatorBrowse(id: string) {
  const row = await db.query.contests.findFirst({
    where: and(eq(contests.id, id), isNull(contests.deletedAt)),
    with: { rewards: true, referenceLinks: true },
  });

  if (!row) {
    throw opportunityError('OPPORTUNITY_NOT_FOUND', 'Contest not found');
  }

  if (!CREATOR_VISIBLE_CONTEST_STATUSES.has(row.status)) {
    throw opportunityError('FORBIDDEN', 'This contest is not available');
  }

  return formatContest(row);
}

export async function getContestSubmissionCount(contestId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contestSubmissions)
    .where(and(eq(contestSubmissions.contestId, contestId), isNull(contestSubmissions.deletedAt)));

  return result?.count ?? 0;
}

export async function getContestPublicLeaderboard(contestId: string, limit = 20) {
  const rows = await db.query.contestSubmissions.findMany({
    where: and(eq(contestSubmissions.contestId, contestId), isNull(contestSubmissions.deletedAt)),
    orderBy: [desc(contestSubmissions.leaderboardScore), desc(contestSubmissions.createdAt)],
    limit,
    with: { creator: true },
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    submissionId: row.id,
    leaderboardScore: row.leaderboardScore,
    thumbnailUrl: row.thumbnailUrl,
    placement: row.placement,
    creatorDisplayName: row.creator?.fullName ?? `Creator ${index + 1}`,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
