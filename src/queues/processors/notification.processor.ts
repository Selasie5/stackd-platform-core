import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { config } from '@/config/index';
import { db } from '@/db/client';
import { deviceTokens, users } from '@/db/schema/index';
import { emailHtml, emailSubject } from '@/notifications/templates';
import { sendPushToTokens } from '@/notifications/push.service';
import type { NotificationJobData } from '@/notifications/types';
import { getQueueConnection } from '@/queues/connection';

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

async function processNotificationJob(data: NotificationJobData): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, data.userId),
    columns: { email: true, role: true },
  });

  if (!user) return;

  if (data.sendEmail && resend) {
    const skipAdminEmail = user.role === 'admin' && !config.ADMIN_NOTIFICATION_EMAIL;
    if (!skipAdminEmail) {
      const { error } = await resend.emails.send({
        from: config.EMAIL_FROM,
        to: user.email,
        subject: emailSubject(data.type, data.title),
        html: emailHtml(data.title, data.body),
      });
      if (error && config.NODE_ENV !== 'test') {
        console.error('[Email] Notification delivery failed:', error);
      }
    }
  } else if (data.sendEmail && config.NODE_ENV !== 'test') {
    console.log(`[Email] To ${user.email}: ${data.title} — ${data.body}`);
  }

  if (data.sendPush) {
    const tokens = await db.query.deviceTokens.findMany({
      where: eq(deviceTokens.userId, data.userId),
      columns: { token: true },
    });
    await sendPushToTokens(
      tokens.map((t) => t.token),
      data.title,
      data.body,
    );
  }
}

let worker: Worker<NotificationJobData> | null = null;

export function startNotificationWorker(): Worker<NotificationJobData> {
  if (worker) return worker;

  worker = new Worker<NotificationJobData>(
    config.NOTIFICATION_QUEUE_NAME,
    async (job) => {
      await processNotificationJob(job.data);
    },
    { connection: getQueueConnection() },
  );

  worker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export async function stopNotificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

/** @internal test helper */
export async function processNotificationJobForTest(data: NotificationJobData): Promise<void> {
  await processNotificationJob(data);
}
