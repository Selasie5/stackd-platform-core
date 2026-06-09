import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { messages } from '@/db/schema/index';
import type { InferSelectModel } from 'drizzle-orm';
import type { SessionData } from '@/auth/types';
import {
  assertCanAccessThread,
  assertValidRecipient,
  type MessageReferenceType,
} from '@/messaging/guards';
import { notify } from '@/notifications/notification.service';

const sendMessageSchema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().min(1),
  referenceType: z.enum(['ugc_order', 'cpm_deal', 'contest', 'dispute']).optional(),
  referenceId: z.string().uuid().optional(),
  attachmentUrl: z.string().url().optional(),
});

type MessageRow = InferSelectModel<typeof messages>;

export function formatMessage(row: MessageRow) {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    body: row.body,
    attachmentUrl: row.attachmentUrl,
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function sendMessage(session: SessionData, input: unknown) {
  const data = sendMessageSchema.parse(input);

  if (data.referenceType && data.referenceId) {
    await assertCanAccessThread(session, data.referenceType, data.referenceId);
  }

  await assertValidRecipient(data.recipientId);

  const [row] = await db
    .insert(messages)
    .values({
      senderId: session.userId,
      recipientId: data.recipientId,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      body: data.body,
      attachmentUrl: data.attachmentUrl ?? null,
    })
    .returning();

  await notify({
    userId: data.recipientId,
    type: 'message_received',
    title: 'New message',
    body: data.body.slice(0, 120),
    referenceType: data.referenceType ?? 'message',
    referenceId: data.referenceId ?? row.id,
  });

  return formatMessage(row);
}

export async function getConversation(
  session: SessionData,
  referenceType: MessageReferenceType,
  referenceId: string,
  limit = 50,
) {
  await assertCanAccessThread(session, referenceType, referenceId);

  const rows = await db.query.messages.findMany({
    where: and(
      eq(messages.referenceType, referenceType),
      eq(messages.referenceId, referenceId),
      isNull(messages.deletedAt),
      or(eq(messages.senderId, session.userId), eq(messages.recipientId, session.userId)),
    ),
    orderBy: [desc(messages.createdAt)],
    limit: Math.min(limit, 100),
  });

  return rows.map(formatMessage);
}

export async function markMessagesRead(
  session: SessionData,
  referenceType: MessageReferenceType,
  referenceId: string,
) {
  await assertCanAccessThread(session, referenceType, referenceId);

  const unread = await db.query.messages.findMany({
    where: and(
      eq(messages.referenceType, referenceType),
      eq(messages.referenceId, referenceId),
      eq(messages.recipientId, session.userId),
      eq(messages.isRead, false),
      isNull(messages.deletedAt),
    ),
  });

  const now = new Date();
  for (const msg of unread) {
    await db
      .update(messages)
      .set({ isRead: true, readAt: now })
      .where(eq(messages.id, msg.id));
  }

  return unread.length;
}
