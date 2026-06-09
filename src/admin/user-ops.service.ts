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

export interface ApplyUserStatusChangeInput {
  userId: string;
  status: 'active' | 'suspended' | 'banned';
  reason?: string;
  skipAdminChecks?: boolean;
}

export async function applyUserStatusChange(
  session: SessionData,
  input: ApplyUserStatusChangeInput,
): Promise<void> {
  if (!input.skipAdminChecks) {
    if (input.userId === session.userId) {
      throw adminError('FORBIDDEN', 'You cannot change your own account status');
    }
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, input.userId), isNull(users.deletedAt)),
  });

  if (!user) throw adminError('NOT_FOUND', 'User not found');
  if (!input.skipAdminChecks && user.role === 'admin') {
    throw adminError('CANNOT_MODIFY_ADMIN', 'Cannot change status of admin accounts');
  }

  const allowedStatuses = ['active', 'suspended', 'pending', 'banned'] as const;
  if (!allowedStatuses.includes(user.status as (typeof allowedStatuses)[number])) {
    throw adminError('INVALID_STATUS', 'User account is not in a modifiable state');
  }

  await db
    .update(users)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(users.id, input.userId));

  if (input.status === 'suspended' || input.status === 'banned') {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, input.userId), isNull(sessions.revokedAt)));
  }

  const statusLabel =
    input.status === 'active'
      ? 'reactivated'
      : input.status === 'suspended'
        ? 'suspended'
        : 'banned';

  await notify({
    userId: input.userId,
    type: 'account_status_changed',
    title: 'Account status updated',
    body: input.reason
      ? `Your account has been ${statusLabel}: ${input.reason}`
      : `Your account has been ${statusLabel}.`,
    referenceType: 'user',
    referenceId: input.userId,
  });
}

export async function updateUserStatus(session: SessionData, input: unknown) {
  const data = updateUserStatusSchema.parse(input);
  await applyUserStatusChange(session, {
    userId: data.userId,
    status: data.status,
    reason: data.reason,
  });
  return getAdminUser(data.userId);
}
