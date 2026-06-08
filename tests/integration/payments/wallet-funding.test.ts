import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { executeGql } from '../../helpers/graphql';
import { createKycApprovedBrand } from '../../helpers/factories';
import { db } from '@/db/client';
import { brandWallets, walletTopUps } from '@/db/schema/index';
import { handlePaystackWebhook } from '@/payments/webhook.handler';
import { signWebhookPayloadForTest } from '@/payments/paystack.client';

const WEBHOOK_SECRET = 'test-webhook-secret';

describe('wallet funding', () => {
  it('credits brand wallet on charge.success webhook', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const brand = await createKycApprovedBrand();
    const brandId = brand.user.brand!.id;
    const userId = brand.user.id;

    const walletBefore = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });
    expect(walletBefore?.availableBalance).toBe('0.00');

    const paystackReference = `topup_${randomUUID()}`;
    const [topUp] = await db
      .insert(walletTopUps)
      .values({
        brandId,
        amount: '5000.00',
        currency: 'NGN',
        paystackReference,
        status: 'pending',
      })
      .returning();

    const payload = {
      event: 'charge.success',
      data: {
        id: 123456,
        reference: paystackReference,
        amount: 500000,
        metadata: {
          type: 'wallet_topup',
          topUpId: topUp.id,
          brandId,
          userId,
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = signWebhookPayloadForTest(rawBody, WEBHOOK_SECRET);

    const result = await handlePaystackWebhook(rawBody, signature);
    expect(result.status).toBe(200);

    const walletAfter = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });
    expect(walletAfter?.availableBalance).toBe('5000.00');

    const updatedTopUp = await db.query.walletTopUps.findFirst({
      where: eq(walletTopUps.id, topUp.id),
    });
    expect(updatedTopUp?.status).toBe('completed');
  });

  it('returns myBrandWallet for kyc-approved brand', async () => {
    const brand = await createKycApprovedBrand();
    const brandId = brand.user.brand!.id;

    await db
      .update(brandWallets)
      .set({ availableBalance: '12000.00' })
      .where(eq(brandWallets.brandId, brandId));

    const result = await executeGql<{
      myBrandWallet: { availableBalance: string; status: string };
    }>(
      `query { myBrandWallet { availableBalance reservedBalance status currency } }`,
      { sessionToken: brand.sessionToken },
    );

    expect(result.data?.myBrandWallet.availableBalance).toBe('12000.00');
    expect(result.data?.myBrandWallet.status).toBe('active');
  });
});
