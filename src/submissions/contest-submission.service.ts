import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  brands,
  contestRewards,
  contestSubmissions,
  contests,
  creators,
} from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import type { SessionData } from '@/auth/types';
import { notify } from '@/notifications/notification.service';
import { allocateEscrow } from '@/payments/escrow.service';
import { submissionError } from '@/submissions/errors';
import {
  assertBrandOwnsOpportunity,
  assertLiveContest,
  assertNoDuplicateContestSubmission,
} from '@/submissions/guards';

const submitSchema = z.object({
  contestId: z.string().uuid(),
  videoUrl: z.string().url().optional(),
  videoLink: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  watermarkedPreviewUrl: z.string().url().optional(),
  submissionNote: z.string().optional(),
  postedVideoLink: z.string().url().optional(),
  platform: z.enum(['tiktok', 'instagram', 'youtube_shorts', 'any']).optional(),
  submittedViews: z.number().int().min(0).optional(),
  engagementCount: z.number().int().min(0).optional(),
  confirmedFollowsBrief: z.boolean(),
  confirmedOriginal: z.boolean(),
  confirmedNoFakeEngagement: z.boolean(),
  agreedToUsageRights: z.boolean(),
});

const winnerInputSchema = z.object({
  contestId: z.string().uuid(),
  winners: z.array(
    z.object({
      submissionId: z.string().uuid(),
      placement: z.number().int().positive(),
    }),
  ),
});

type ContestSubmissionRow = InferSelectModel<typeof contestSubmissions>;

export function formatContestSubmission(row: ContestSubmissionRow) {
  return {
    id: row.id,
    contestId: row.contestId,
    creatorId: row.creatorId,
    videoUrl: row.videoUrl,
    videoLink: row.videoLink,
    thumbnailUrl: row.thumbnailUrl,
    watermarkedPreviewUrl: row.watermarkedPreviewUrl,
    cleanVideoUrl: row.cleanVideoUrl,
    submissionNote: row.submissionNote,
    postingRequired: row.postingRequired,
    postedVideoLink: row.postedVideoLink,
    platform: row.platform,
    submittedViews: row.submittedViews,
    approvedViews: row.approvedViews,
    engagementCount: row.engagementCount,
    leaderboardScore: row.leaderboardScore,
    placement: row.placement,
    rewardAmount: row.rewardAmount,
    status: row.status,
    shortlistedAt: row.shortlistedAt?.toISOString() ?? null,
    winnerSelectedAt: row.winnerSelectedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getSubmission(id: string) {
  const row = await db.query.contestSubmissions.findFirst({
    where: and(eq(contestSubmissions.id, id), isNull(contestSubmissions.deletedAt)),
  });
  if (!row) throw submissionError('SUBMISSION_NOT_FOUND', 'Submission not found');
  return row;
}

export async function submitContestSubmission(session: SessionData, input: unknown) {
  if (!session.creatorId) throw submissionError('FORBIDDEN', 'Creator profile required');
  const data = submitSchema.parse(input);

  if (!data.confirmedFollowsBrief || !data.confirmedOriginal || !data.confirmedNoFakeEngagement || !data.agreedToUsageRights) {
    throw submissionError('INVALID_STATUS', 'All contest confirmations are required');
  }

  const contest = await assertLiveContest(data.contestId);
  await assertNoDuplicateContestSubmission(data.contestId, session.creatorId);

  const [row] = await db
    .insert(contestSubmissions)
    .values({
      contestId: data.contestId,
      creatorId: session.creatorId,
      videoUrl: data.videoUrl,
      videoLink: data.videoLink,
      thumbnailUrl: data.thumbnailUrl,
      watermarkedPreviewUrl: data.watermarkedPreviewUrl,
      submissionNote: data.submissionNote,
      postingRequired: contest.postingRequired,
      postedVideoLink: data.postedVideoLink,
      platform: data.platform,
      submittedViews: data.submittedViews ?? 0,
      engagementCount: data.engagementCount ?? 0,
      confirmedFollowsBrief: data.confirmedFollowsBrief,
      confirmedOriginal: data.confirmedOriginal,
      confirmedNoFakeEngagement: data.confirmedNoFakeEngagement,
      agreedToUsageRights: data.agreedToUsageRights,
      status: 'submitted',
    })
    .returning();

  const brand = await db.query.brands.findFirst({ where: eq(brands.id, contest.brandId) });
  if (brand) {
    await notify({
      userId: brand.userId,
      type: 'submission_received',
      title: 'New contest submission',
      body: `A creator submitted to "${contest.title}".`,
      referenceType: 'contest_submission',
      referenceId: row.id,
    });
  }

  return formatContestSubmission(row);
}

export async function shortlistContestSubmission(session: SessionData, submissionId: string) {
  const submission = await getSubmission(submissionId);
  const contest = await db.query.contests.findFirst({ where: eq(contests.id, submission.contestId) });
  if (!contest) throw submissionError('SUBMISSION_NOT_FOUND', 'Contest not found');
  assertBrandOwnsOpportunity(session, contest.brandId);

  const now = new Date();
  const [updated] = await db
    .update(contestSubmissions)
    .set({ status: 'shortlisted', shortlistedAt: now, updatedAt: now })
    .where(eq(contestSubmissions.id, submissionId))
    .returning();

  const creator = await db.query.creators.findFirst({ where: eq(creators.id, submission.creatorId) });
  if (creator) {
    await notify({
      userId: creator.userId,
      type: 'shortlisted',
      title: 'You have been shortlisted',
      body: `Your submission for "${contest.title}" has been shortlisted.`,
      referenceType: 'contest_submission',
      referenceId: submissionId,
    });
  }

  return formatContestSubmission(updated);
}

export async function selectContestWinners(session: SessionData, input: unknown) {
  const data = winnerInputSchema.parse(input);
  const contest = await db.query.contests.findFirst({
    where: and(eq(contests.id, data.contestId), isNull(contests.deletedAt)),
  });
  if (!contest) throw submissionError('SUBMISSION_NOT_FOUND', 'Contest not found');
  assertBrandOwnsOpportunity(session, contest.brandId);

  const rewards = await db.query.contestRewards.findMany({
    where: eq(contestRewards.contestId, contest.id),
  });
  const rewardByPlacement = new Map(rewards.map((r) => [r.placement, r]));

  const results = [];
  const now = new Date();

  for (const winner of data.winners) {
    const submission = await getSubmission(winner.submissionId);
    if (submission.contestId !== contest.id) {
      throw submissionError('INVALID_STATUS', 'Submission does not belong to this contest');
    }

    const reward = rewardByPlacement.get(winner.placement);
    if (!reward) {
      throw submissionError('INVALID_STATUS', `No reward configured for placement ${winner.placement}`);
    }

    const [updated] = await db
      .update(contestSubmissions)
      .set({
        status: 'winner',
        placement: winner.placement,
        rewardAmount: reward.amount,
        winnerSelectedAt: now,
        updatedAt: now,
      })
      .where(eq(contestSubmissions.id, winner.submissionId))
      .returning();

    await allocateEscrow({
      opportunityType: 'CONTEST',
      opportunityId: contest.id,
      submissionType: 'contest_submission',
      submissionId: updated.id,
      creatorId: submission.creatorId,
      amount: reward.amount,
      currency: reward.currency,
    });

    const creator = await db.query.creators.findFirst({ where: eq(creators.id, submission.creatorId) });
    if (creator) {
      await notify({
        userId: creator.userId,
        type: 'winner_selected',
        title: 'Contest winner',
        body: `You placed #${winner.placement} in "${contest.title}". Earnings release when the campaign completes.`,
        referenceType: 'contest_submission',
        referenceId: winner.submissionId,
      });
    }

    results.push(formatContestSubmission(updated));
  }

  return results;
}

export async function listContestSubmissionsForContest(session: SessionData, contestId: string) {
  const contest = await db.query.contests.findFirst({
    where: and(eq(contests.id, contestId), isNull(contests.deletedAt)),
  });
  if (!contest) throw submissionError('SUBMISSION_NOT_FOUND', 'Contest not found');
  assertBrandOwnsOpportunity(session, contest.brandId);

  const rows = await db.query.contestSubmissions.findMany({
    where: and(eq(contestSubmissions.contestId, contestId), isNull(contestSubmissions.deletedAt)),
  });
  return rows.map(formatContestSubmission);
}

export async function listMyContestSubmissions(creatorId: string) {
  const rows = await db.query.contestSubmissions.findMany({
    where: and(eq(contestSubmissions.creatorId, creatorId), isNull(contestSubmissions.deletedAt)),
  });
  return rows.map(formatContestSubmission);
}
