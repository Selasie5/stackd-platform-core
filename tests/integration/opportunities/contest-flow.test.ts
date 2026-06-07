import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  defaultContestInput,
  ensureAdminSession,
  fundBrandWallet,
} from '../../helpers/factories';
import { db } from '@/db/client';
import { contestReferenceLinks, contestRewards, contests } from '@/db/schema/index';

describe('contest flow', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it('create with rewards and reference links, submit, approve', async () => {
    const brand = await createKycApprovedBrand();
    const brandId = brand.user.brand!.id;
    await fundBrandWallet(brandId, '200000.00');

    const createResult = await executeGql<{
      createContest: { id: string; status: string; rewards: { placement: number }[] };
    }>(
      `mutation($input: CreateContestInput!) {
        createContest(input: $input) {
          id
          status
          rewards { placement amount }
          referenceLinks { url isInspiration }
        }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { input: defaultContestInput() },
      },
    );

    const contestId = createResult.data?.createContest.id;
    expect(createResult.data?.createContest.status).toBe('draft');
    expect(createResult.data?.createContest.rewards).toHaveLength(3);
    if (!contestId) throw new Error('Expected contest id');

    const rewards = await db.query.contestRewards.findMany({
      where: eq(contestRewards.contestId, contestId),
    });
    expect(rewards).toHaveLength(3);

    const links = await db.query.contestReferenceLinks.findMany({
      where: eq(contestReferenceLinks.contestId, contestId),
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.isInspiration).toBe(true);

    await executeGql(
      `mutation($type: OpportunityType!, $id: ID!) {
        submitOpportunityForApproval(type: $type, id: $id) { ... on Contest { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'CONTEST', id: contestId },
      },
    );

    const approveResult = await executeGql<{ reviewOpportunity: { status: string } }>(
      `mutation($input: ReviewOpportunityInput!) {
        reviewOpportunity(input: $input) { ... on Contest { status } }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: { type: 'CONTEST', id: contestId, decision: 'approved' },
        },
      },
    );
    expect(approveResult.data?.reviewOpportunity.status).toBe('live');

    const contest = await db.query.contests.findFirst({
      where: eq(contests.id, contestId),
    });
    expect(contest?.status).toBe('live');
    expect(contest?.reservedAt).toBeTruthy();
  });
});
