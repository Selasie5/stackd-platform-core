import type { notifications } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';

export type NotificationRow = InferSelectModel<typeof notifications>;
export type NotificationType = NotificationRow['type'];

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
  sendEmail?: boolean;
  sendPush?: boolean;
}

export interface NotifyAdminsInput {
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
}

export interface NotificationJobData {
  userId: string;
  notificationId: string;
  type: NotificationType;
  title: string;
  body: string;
  sendEmail: boolean;
  sendPush: boolean;
}
