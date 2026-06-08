import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { executeGql } from '../../helpers/graphql';
import { createKycApprovedCreator, ensureAdminSession, fundCreatorWallet } from '../../helpers/factories';
import { db } from '@/db/client';
import { creatorWallets, withdrawals } from '@/db/schema/index';
import { handlePaystackWebhook } from '@/payments/webhook.handler';
import { signWebhookPayloadForTest } from '@/payments/paystack.client';
import { debitCreatorWallet } from '@/wallets/creator-wallet.service';

const WEBHOOK_SECRET = 'test-webhook-secret';

describe('withdrawal flow', () => {
  it('completes withdrawal on transfer.success webhook', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const creator = await createKycApprovedCreator();
    const creatorId = creator.user.creator!.id;
    await fundCreatorWallet(creatorId, '3000.00');

    const wallet = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    if (!wallet) throw new Error('Expected creator wallet');

    const paystackReference = `withdraw_${randomUUID()}`;
    const [withdrawal] = await db
      .insert(withdrawals)
      .values({
        creatorId,
        walletId: wallet.id,
        amount: '2000.00',
        currency: 'NGN',
        paystackReference,
        status: 'processing',
      })
      .returning();

    await debitCreatorWallet(creatorId, '2000.00', 'NGN', {
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      description: 'Test withdrawal debit',
    });

    const payload = {
      event: 'transfer.success',
      data: {
        id: 987654,
        reference: paystackReference,
        status: 'success',
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = signWebhookPayloadForTest(rawBody, WEBHOOK_SECRET);
    const result = await handlePaystackWebhook(rawBody, signature);
    expect(result.status).toBe(200);

    const updated = await db.query.withdrawals.findFirst({
      where: eq(withdrawals.id, withdrawal.id),
    });
    expect(updated?.status).toBe('completed');

    const walletAfter = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    expect(walletAfter?.availableBalance).toBe('1000.00');
    expect(walletAfter?.totalWithdrawn).toBe('2000.00');
  });

  it('reverses wallet debit on transfer.failed webhook', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const creator = await createKycApprovedCreator();
    const creatorId = creator.user.creator!.id;
    await fundCreatorWallet(creatorId, '5000.00');

    const wallet = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    if (!wallet) throw new Error('Expected creator wallet');

    const paystackReference = `withdraw_${randomUUID()}`;
    const [withdrawal] = await db
      .insert(withdrawals)
      .values({
        creatorId,
        walletId: wallet.id,
        amount: '1500.00',
        currency: 'NGN',
        paystackReference,
        status: 'processing',
      })
      .returning();

    await debitCreatorWallet(creatorId, '1500.00', 'NGN', {
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      description: 'Test withdrawal debit',
    });

    const payload = {
      event: 'transfer.failed',
      data: {
        id: 987655,
        reference: paystackReference,
        reason: 'Insufficient Paystack balance',
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = signWebhookPayloadForTest(rawBody, WEBHOOK_SECRET);
    await handlePaystackWebhook(rawBody, signature);

    const updated = await db.query.withdrawals.findFirst({
      where: eq(withdrawals.id, withdrawal.id),
    });
    expect(updated?.status).toBe('failed');

    const walletAfter = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    expect(walletAfter?.availableBalance).toBe('5000.00');
    expect(walletAfter?.totalWithdrawn).toBe('0.00');
  });

  it('lists creator wallet history and admin withdrawals', async () => {
    const creator = await createKycApprovedCreator();
    const creatorId = creator.user.creator!.id;
    await fundCreatorWallet(creatorId, '2500.00');

    const walletResult = await executeGql<{
      myCreatorWallet: { availableBalance: string; status: string };
    }>(
      `query { myCreatorWallet { availableBalance totalEarned status currency } }`,
      { sessionToken: creator.sessionToken },
    );
    expect(walletResult.data?.myCreatorWallet.availableBalance).toBe('2500.00');
    expect(walletResult.data?.myCreatorWallet.status).toBe('active');

    const admin = await ensureAdminSession();
    const paystackReference = `withdraw_${randomUUID()}`;
    const wallet = await db.query.creatorWallets.findFirst({
      where: eq(creatorWallets.creatorId, creatorId),
    });
    if (!wallet) throw new Error('Expected creator wallet');

    await db.insert(withdrawals).values({
      creatorId,
      walletId: wallet.id,
      amount: '1000.00',
      currency: 'NGN',
      paystackReference,
      status: 'completed',
      completedAt: new Date(),
    });

    const adminResult = await executeGql<{
      adminWithdrawals: Array<{ amount: string; status: string; creatorName: string | null }>;
    }>(
      `query { adminWithdrawals(status: completed) { amount status creatorName paystackReference } }`,
      { sessionToken: admin.sessionToken },
    );

    const rows = adminResult.data?.adminWithdrawals ?? [];
    expect(rows.some((row) => row.amount === '1000.00' && row.status === 'completed')).toBe(true);
  });
});
