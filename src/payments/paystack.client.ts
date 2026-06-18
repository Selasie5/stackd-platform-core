import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '@/config/index';
import { paymentError } from '@/payments/errors';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function requireSecretKey(): string {
  if (!config.PAYSTACK_SECRET_KEY) {
    throw paymentError('PAYSTACK_NOT_CONFIGURED', 'Paystack is not configured');
  }
  return config.PAYSTACK_SECRET_KEY;
}

export function toPaystackAmount(amount: string, currency: 'NGN' | 'GHS' | 'USD'): number {
  void currency;
  const value = parseFloat(amount);
  if (Number.isNaN(value) || value <= 0) {
    throw paymentError('INVALID_AMOUNT', 'Amount must be greater than zero');
  }
  // Paystack expects smallest currency unit (kobo, pesewas, cents).
  return Math.round(value * 100);
}

async function paystackFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const body = (await response.json()) as { status: boolean; message: string; data: T };

  if (!response.ok || !body.status) {
    throw new Error(body.message || `Paystack request failed: ${response.status}`);
  }

  return body.data;
}

export interface InitializeTransactionResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(input: {
  email: string;
  amount: number;
  currency: 'NGN' | 'GHS' | 'USD';
  reference: string;
  metadata: Record<string, string>;
  callbackUrl?: string;
}): Promise<InitializeTransactionResult> {
  return paystackFetch<InitializeTransactionResult>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      metadata: input.metadata,
      callback_url: input.callbackUrl,
    }),
  });
}

export interface VerifyTransactionResult {
  status: string;
  reference: string;
  amount: number;
  metadata?: {
    type?: string;
    topUpId?: string;
    brandId?: string;
    userId?: string;
  };
}

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  return paystackFetch<VerifyTransactionResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  const webhookSecret = config.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!webhookSecret || !signature) {
    return false;
  }

  const hash = createHmac('sha512', webhookSecret).update(rawBody).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

export interface TransferRecipientResult {
  recipient_code: string;
  details: Record<string, unknown>;
}

export async function createTransferRecipient(input: {
  type: 'nuban' | 'mobile_money';
  name: string;
  accountNumber: string;
  bankCode: string;
  currency: 'NGN' | 'GHS' | 'USD';
}): Promise<TransferRecipientResult> {
  return paystackFetch<TransferRecipientResult>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: input.type,
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency,
    }),
  });
}

export interface InitiateTransferResult {
  transfer_code: string;
  reference: string;
  status: string;
}

export async function initiateTransfer(input: {
  amount: number;
  recipientCode: string;
  reason: string;
  reference: string;
  currency: 'NGN' | 'GHS' | 'USD';
}): Promise<InitiateTransferResult> {
  return paystackFetch<InitiateTransferResult>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: input.amount,
      recipient: input.recipientCode,
      reason: input.reason,
      reference: input.reference,
      currency: input.currency,
    }),
  });
}

/** @internal test helper */
export function signWebhookPayloadForTest(rawBody: string, secret: string): string {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}
