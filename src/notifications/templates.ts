import type { NotificationType } from '@/notifications/types';

const ADMIN_TYPES: NotificationType[] = [
  'admin_kyc_pending_review',
  'admin_campaign_pending_review',
  'admin_dispute_opened',
];

export function shouldSendEmail(type: NotificationType): boolean {
  return (
    ADMIN_TYPES.includes(type) ||
    type.startsWith('kyc_') ||
    type === 'payment_paid' ||
    type === 'payment_ready'
  );
}

export function shouldSendPush(type: NotificationType): boolean {
  return (
    shouldSendEmail(type) ||
    type === 'submission_received' ||
    type === 'dispute_opened' ||
    type === 'message_received' ||
    type === 'account_status_changed' ||
    type === 'wallet_frozen' ||
    type === 'wallet_unfrozen' ||
    type === 'campaign_rejected'
  );
}

export function emailSubject(type: NotificationType, title: string): string {
  return `Splennet: ${title}`;
}

export function emailHtml(title: string, body: string): string {
  return `
    <p><strong>${title}</strong></p>
    <p>${body}</p>
    <p>— Splennet</p>
  `;
}
