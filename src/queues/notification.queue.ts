import { Queue } from 'bullmq';
import { config } from '@/config/index';
import type { NotificationJobData } from '@/notifications/types';
import { getQueueConnection } from '@/queues/connection';

let notificationQueue: Queue<NotificationJobData> | null = null;

function getNotificationQueue(): Queue<NotificationJobData> {
  if (!notificationQueue) {
    notificationQueue = new Queue<NotificationJobData>(config.NOTIFICATION_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
  }
  return notificationQueue;
}

export async function enqueueNotificationDelivery(data: NotificationJobData): Promise<void> {
  // Tests assert in-app notifications only; skip queue/email/push delivery.
  if (config.NODE_ENV === 'test') {
    return;
  }

  await getNotificationQueue().add('deliver' as const, data, {
    jobId: `notification-${data.notificationId}`,
  });
}
