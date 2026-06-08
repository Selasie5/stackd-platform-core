import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { executeGql, expectGqlError } from '../../helpers/graphql';
import {
  createKycApprovedBrand,
  createVerifiedBrand,
  defaultUgcOrderInput,
  ensureAdminSession,
  fundBrandWallet,
} from '../../helpers/factories';
import { db } from '@/db/client';
import { brandWallets } from '@/db/schema/index';

describe('ugc order flow', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'full lifecycle: create, update, submit, approve, pause, resume, close, complete',
    async () => {
    const brand = await createKycApprovedBrand();
    const brandId = brand.user.brand!.id;
    await fundBrandWallet(brandId, '100000.00');

    const createResult = await executeGql<{ createUgcOrder: { id: string; status: string } }>(
      `mutation($input: CreateUgcOrderInput!) {
        createUgcOrder(input: $input) { id status title }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { input: defaultUgcOrderInput() },
      },
    );
    const orderId = createResult.data?.createUgcOrder.id;
    expect(createResult.data?.createUgcOrder.status).toBe('draft');
    if (!orderId) throw new Error('Expected order id');

    const updateResult = await executeGql<{ updateUgcOrder: { title: string } }>(
      `mutation($id: ID!, $input: CreateUgcOrderInput!) {
        updateUgcOrder(id: $id, input: $input) { title }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: {
          id: orderId,
          input: defaultUgcOrderInput({ title: 'Updated UGC Campaign' }),
        },
      },
    );
    expect(updateResult.data?.updateUgcOrder.title).toBe('Updated UGC Campaign');

    const submitResult = await executeGql<{ submitOpportunityForApproval: { status: string } }>(
      `mutation($type: OpportunityType!, $id: ID!) {
        submitOpportunityForApproval(type: $type, id: $id) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'UGC_ORDER', id: orderId },
      },
    );
    expect(submitResult.data?.submitOpportunityForApproval.status).toBe('pending_approval');

    const walletBefore = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });
    expect(walletBefore?.availableBalance).toBe('100000.00');
    expect(walletBefore?.reservedBalance).toBe('0.00');

    const approveResult = await executeGql<{ reviewOpportunity: { status: string } }>(
      `mutation($input: ReviewOpportunityInput!) {
        reviewOpportunity(input: $input) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: { type: 'UGC_ORDER', id: orderId, decision: 'approved' },
        },
      },
    );
    expect(approveResult.data?.reviewOpportunity.status).toBe('live');

    const walletAfterApprove = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });
    expect(walletAfterApprove?.availableBalance).toBe('75000.00');
    expect(walletAfterApprove?.reservedBalance).toBe('25000.00');

    await executeGql(
      `mutation($type: OpportunityType!, $id: ID!) {
        pauseOpportunity(type: $type, id: $id) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'UGC_ORDER', id: orderId },
      },
    );

    const resumeResult = await executeGql<{ resumeOpportunity: { status: string } }>(
      `mutation($type: OpportunityType!, $id: ID!) {
        resumeOpportunity(type: $type, id: $id) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'UGC_ORDER', id: orderId },
      },
    );
    expect(resumeResult.data?.resumeOpportunity.status).toBe('live');

    const closeResult = await executeGql<{ closeOpportunity: { status: string } }>(
      `mutation($type: OpportunityType!, $id: ID!) {
        closeOpportunity(type: $type, id: $id) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'UGC_ORDER', id: orderId },
      },
    );
    expect(closeResult.data?.closeOpportunity.status).toBe('closed');

    await executeGql(
      `mutation($type: OpportunityType!, $id: ID!) {
        completeOpportunity(type: $type, id: $id) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'UGC_ORDER', id: orderId },
      },
    );

    const walletAfterComplete = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });
    expect(walletAfterComplete?.reservedBalance).toBe('0.00');
    expect(walletAfterComplete?.availableBalance).toBe('100000.00');
    expect(walletAfterComplete?.totalSpent).toBe('0.00');
  },
    120_000,
  );

  it('blocks create when KYC not approved', async () => {
    const brand = await createVerifiedBrand();
    const result = await executeGql(
      `mutation($input: CreateUgcOrderInput!) {
        createUgcOrder(input: $input) { id }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { input: defaultUgcOrderInput() },
      },
    );
    expectGqlError(result, 'KYC_NOT_APPROVED');
  });

  it('blocks approve when wallet balance insufficient', async () => {
    const brand = await createKycApprovedBrand();
    const brandId = brand.user.brand!.id;
    await fundBrandWallet(brandId, '1000.00');

    const createResult = await executeGql<{ createUgcOrder: { id: string } }>(
      `mutation($input: CreateUgcOrderInput!) {
        createUgcOrder(input: $input) { id }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { input: defaultUgcOrderInput() },
      },
    );
    const orderId = createResult.data?.createUgcOrder.id;
    if (!orderId) throw new Error('Expected order id');

    await executeGql(
      `mutation($type: OpportunityType!, $id: ID!) {
        submitOpportunityForApproval(type: $type, id: $id) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: brand.sessionToken,
        variables: { type: 'UGC_ORDER', id: orderId },
      },
    );

    const approveResult = await executeGql(
      `mutation($input: ReviewOpportunityInput!) {
        reviewOpportunity(input: $input) { ... on UgcOrder { status } }
      }`,
      {
        sessionToken: adminSession.sessionToken,
        variables: {
          input: { type: 'UGC_ORDER', id: orderId, decision: 'approved' },
        },
      },
    );
    expectGqlError(approveResult, 'INSUFFICIENT_WALLET_BALANCE');
  });
});
