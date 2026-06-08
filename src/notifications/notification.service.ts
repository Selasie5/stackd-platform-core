import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notifications } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import { listActiveAdminUserIds } from '@/notifications/admin.service';
import { notificationError } from '@/notifications/errors';
import { shouldSendEmail, shouldSendPush } from '@/notifications/templates';
import type { NotificationRow, NotifyAdminsInput, NotifyInput } from '@/notifications/types';
import { enqueueNotificationDelivery } from '@/queues/notification.queue';

type NotificationDbRow = InferSelectModel<typeof notifications>;

export function formatNotification(row: NotificationDbRow): NotificationRow {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    isRead: row.isRead,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export async function notify(input: NotifyInput): Promise<NotificationRow> {
  const sendEmail = input.sendEmail ?? shouldSendEmail(input.type);
  const sendPush = input.sendPush ?? shouldSendPush(input.type);

  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    })
    .returning();

  await enqueueNotificationDelivery({
    userId: input.userId,
    notificationId: row.id,
    type: input.type,
    title: input.title,
    body: input.body,
    sendEmail,
    sendPush,
  });

  return formatNotification(row);
}

export async function notifyAdmins(input: NotifyAdminsInput): Promise<void> {
  const adminIds = await listActiveAdminUserIds();
  await Promise.all(
    adminIds.map((userId) =>
      notify({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        sendEmail: true,
        sendPush: true,
      }),
    ),
  );
}

export async function listMyNotifications(userId: string, unreadOnly = false) {
  const rows = await db.query.notifications.findMany({
    where: unreadOnly
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : eq(notifications.userId, userId),
    orderBy: desc(notifications.createdAt),
    limit: 50,
  });
  return rows.map(formatNotification);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await db.query.notifications.findMany({
    where: and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    columns: { id: true },
  });
  return rows.length;
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationRow> {
  const row = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, notificationId), eq(notifications.userId, userId)),
  });

  if (!row) {
    throw notificationError('NOTIFICATION_NOT_FOUND', 'Notification not found');
  }

  if (row.isRead) {
    return formatNotification(row);
  }

  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, notificationId))
    .returning();

  return formatNotification(updated);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const unread = await db.query.notifications.findMany({
    where: and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    columns: { id: true },
  });

  if (unread.length === 0) return 0;

  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return unread.length;
}
