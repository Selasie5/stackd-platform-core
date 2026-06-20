import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notificationPreferences } from '@/db/schema/index';

export interface NotificationPreferences {
  emailMarketing: boolean;
  emailSecurity: boolean;
  emailCampaignUpdates: boolean;
  pushMarketing: boolean;
  pushSecurity: boolean;
  pushCampaignUpdates: boolean;
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  let prefs = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  if (!prefs) {
    const [created] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .returning();
    prefs = created;
  }

  return {
    emailMarketing: prefs.emailMarketing,
    emailSecurity: prefs.emailSecurity,
    emailCampaignUpdates: prefs.emailCampaignUpdates,
    pushMarketing: prefs.pushMarketing,
    pushSecurity: prefs.pushSecurity,
    pushCampaignUpdates: prefs.pushCampaignUpdates,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  input: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const existing = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  if (!existing) {
    const [created] = await db
      .insert(notificationPreferences)
      .values({ userId, ...input })
      .returning();

    return {
      emailMarketing: created.emailMarketing,
      emailSecurity: created.emailSecurity,
      emailCampaignUpdates: created.emailCampaignUpdates,
      pushMarketing: created.pushMarketing,
      pushSecurity: created.pushSecurity,
      pushCampaignUpdates: created.pushCampaignUpdates,
    };
  }

  const [updated] = await db
    .update(notificationPreferences)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(notificationPreferences.userId, userId))
    .returning();

  return {
    emailMarketing: updated.emailMarketing,
    emailSecurity: updated.emailSecurity,
    emailCampaignUpdates: updated.emailCampaignUpdates,
    pushMarketing: updated.pushMarketing,
    pushSecurity: updated.pushSecurity,
    pushCampaignUpdates: updated.pushCampaignUpdates,
  };
}
