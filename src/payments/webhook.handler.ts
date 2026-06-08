import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { paystackEvents } from '@/db/schema/index';
import { completeWalletTopUpFromWebhook } from '@/payments/wallet-funding.service';
import { completeWithdrawalFromWebhook } from '@/payments/withdrawal.service';
import { verifyWebhookSignature } from '@/payments/paystack.client';

interface PaystackWebhookPayload {
  event: string;
  data: {
    id?: number;
    reference?: string;
    amount?: number;
    metadata?: {
      type?: string;
      topUpId?: string;
      brandId?: string;
      userId?: string;
      withdrawalId?: string;
    };
    reason?: string;
  };
}

export async function handlePaystackWebhook(
  rawBody: string,
  signature: string | undefined,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!verifyWebhookSignature(rawBody, signature)) {
    return { status: 401, body: { error: 'Invalid signature' } };
  }

  let payload: PaystackWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  } catch {
    return { status: 400, body: { error: 'Invalid JSON' } };
  }

  const eventId = String(payload.data?.id ?? payload.data?.reference ?? payload.event);
  const existing = await db.query.paystackEvents.findFirst({
    where: eq(paystackEvents.eventId, eventId),
  });

  if (existing) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  await db.insert(paystackEvents).values({
    eventId,
    eventType: payload.event,
    reference: payload.data?.reference ?? null,
    payload,
  });

  if (payload.event === 'charge.success') {
    const metadata = payload.data?.metadata;
    if (metadata?.type === 'wallet_topup' && metadata.topUpId && metadata.brandId && metadata.userId) {
      await completeWalletTopUpFromWebhook({
        topUpId: metadata.topUpId,
        brandId: metadata.brandId,
        userId: metadata.userId,
        paystackReference: payload.data?.reference ?? '',
        amountPaid: payload.data?.amount ?? 0,
      });
    }
  }

  if (payload.event === 'transfer.success' && payload.data?.reference) {
    await completeWithdrawalFromWebhook({
      paystackReference: payload.data.reference,
      event: 'transfer.success',
      paystackStatus: 'success',
    });
  }

  if (payload.event === 'transfer.failed' && payload.data?.reference) {
    await completeWithdrawalFromWebhook({
      paystackReference: payload.data.reference,
      event: 'transfer.failed',
      paystackStatus: 'failed',
      failureReason: payload.data.reason,
    });
  }

  return { status: 200, body: { received: true } };
}
