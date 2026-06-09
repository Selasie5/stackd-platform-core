import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  contests,
  cpmDeals,
  disputes,
  kycApplications,
  notifications,
  ugcOrders,
  users,
} from '@/db/schema/index';

export async function listActiveAdminUserIds(): Promise<string[]> {
  const admins = await db.query.users.findMany({
    where: and(eq(users.role, 'admin'), eq(users.status, 'active'), isNull(users.deletedAt)),
    columns: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function getAdminActionCounts(adminUserId: string) {
  const [pendingKyc, pendingUgc, pendingCpm, pendingContests, openDisputes, unreadNotifications] =
    await Promise.all([
      db.query.kycApplications.findMany({
        where: eq(kycApplications.status, 'pending_review'),
        columns: { id: true },
      }),
      db.query.ugcOrders.findMany({
        where: and(eq(ugcOrders.status, 'pending_approval'), isNull(ugcOrders.deletedAt)),
        columns: { id: true },
      }),
      db.query.cpmDeals.findMany({
        where: and(eq(cpmDeals.status, 'pending_approval'), isNull(cpmDeals.deletedAt)),
        columns: { id: true },
      }),
      db.query.contests.findMany({
        where: and(eq(contests.status, 'pending_approval'), isNull(contests.deletedAt)),
        columns: { id: true },
      }),
      db.query.disputes.findMany({
        where: and(
          inArray(disputes.status, ['open', 'under_review']),
          isNull(disputes.deletedAt),
        ),
        columns: { id: true },
      }),
      db.query.notifications.findMany({
        where: and(eq(notifications.userId, adminUserId), eq(notifications.isRead, false)),
        columns: { id: true },
      }),
    ]);

  return {
    pendingKyc: pendingKyc.length,
    pendingCampaigns: pendingUgc.length + pendingCpm.length + pendingContests.length,
    openDisputes: openDisputes.length,
    unreadNotifications: unreadNotifications.length,
  };
}
