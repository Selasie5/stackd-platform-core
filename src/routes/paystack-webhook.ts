import type { Request, Response } from 'express';
import { handlePaystackWebhook } from '@/payments/webhook.handler';

export async function paystackWebhookHandler(req: Request, res: Response): Promise<void> {
  const rawBody =
    typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  const signature = req.headers['x-paystack-signature'] as string | undefined;
  const result = await handlePaystackWebhook(rawBody, signature);
  res.status(result.status).json(result.body);
}
