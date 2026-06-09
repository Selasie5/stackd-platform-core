import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { sessions, users } from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { adminError } from '@/admin/errors';
import { getAdminUser } from '@/admin/directory.service';
import { notify } from '@/notifications/notification.service';

const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().optional(),
});

export async function updateUserStatus(session: SessionData, input: unknown) {
  const data = updateUserStatusSchema.parse(input);

  if (data.userId === session.userId) {
    throw adminError('FORBIDDEN', 'You cannot change your own account status');
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, data.userId), isNull(users.deletedAt)),
  });

  if (!user) throw adminError('NOT_FOUND', 'User not found');
  if (user.role === 'admin') {
    throw adminError('CANNOT_MODIFY_ADMIN', 'Cannot change status of admin accounts');
  }

  const allowedStatuses = ['active', 'suspended', 'pending', 'banned'] as const;
  if (!allowedStatuses.includes(user.status as (typeof allowedStatuses)[number])) {
    throw adminError('INVALID_STATUS', 'User account is not in a modifiable state');
  }

  await db
    .update(users)
    .set({ status: data.status, updatedAt: new Date() })
    .where(eq(users.id, data.userId));

  if (data.status === 'suspended' || data.status === 'banned') {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, data.userId), isNull(sessions.revokedAt)));
  }

  const statusLabel =
    data.status === 'active' ? 'reactivated' : data.status === 'suspended' ? 'suspended' : 'banned';

  await notify({
    userId: data.userId,
    type: 'account_status_changed',
    title: 'Account status updated',
    body: data.reason
      ? `Your account has been ${statusLabel}: ${data.reason}`
      : `Your account has been ${statusLabel}.`,
    referenceType: 'user',
    referenceId: data.userId,
  });

  return getAdminUser(data.userId);
}
