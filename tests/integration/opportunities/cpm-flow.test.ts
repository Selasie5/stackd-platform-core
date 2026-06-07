import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  defaultCpmDealInput,
  ensureAdminSession,
  fundBrandWallet,
} from '../../helpers/factories';

describe('cpm deal flow', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it('create, submit, reject, resubmit, approve', async () => {
    const brand = await createKycApprovedBrand();
    const brandId = brand.user.brand!.id;
    await fundBrandWallet(brandId, '100000.00');

    const createResult = await executeGql<{ createCpmDeal: { id: string; status: string } }>(
      `mutation($input: CreateCpmDealInput!) {
        createCpmDeal(input: $input) { id status }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { input: defaultCpmDealInput() },
      },
    );
    const dealId = createResult.data?.createCpmDeal.id;
    expect(createResult.data?.createCpmDeal.status).toBe('draft');
    if (!dealId) throw new Error('Expected deal id');

    await executeGql(
      `mutation($type: OpportunityType!, $id: ID!) {
        submitOpportunityForApproval(type: $type, id: $id) { ... on CpmDeal { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'CPM_DEAL', id: dealId },
      },
    );

    const rejectResult = await executeGql<{ reviewOpportunity: { status: string } }>(
      `mutation($input: ReviewOpportunityInput!) {
        reviewOpportunity(input: $input) { ... on CpmDeal { status } }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: { type: 'CPM_DEAL', id: dealId, decision: 'rejected', adminNote: 'Needs clearer brief' },
        },
      },
    );
    expect(rejectResult.data?.reviewOpportunity.status).toBe('draft');

    await executeGql(
      `mutation($type: OpportunityType!, $id: ID!) {
        submitOpportunityForApproval(type: $type, id: $id) { ... on CpmDeal { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'CPM_DEAL', id: dealId },
      },
    );

    const approveResult = await executeGql<{ reviewOpportunity: { status: string } }>(
      `mutation($input: ReviewOpportunityInput!) {
        reviewOpportunity(input: $input) { ... on CpmDeal { status } }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: { type: 'CPM_DEAL', id: dealId, decision: 'approved' },
        },
      },
    );
    expect(approveResult.data?.reviewOpportunity.status).toBe('live');
  });
});
