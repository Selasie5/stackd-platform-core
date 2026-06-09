import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '@/db/client';
import { paystackEvents } from '@/db/schema/index';
import { clampLimit } from '@/admin/list.utils';

export async function listAdminPaystackEvents(filters: {
  eventType?: string;
  reference?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters.eventType) conditions.push(eq(paystackEvents.eventType, filters.eventType));
  if (filters.reference) {
    conditions.push(ilike(paystackEvents.reference, `%${filters.reference}%`));
  }

  const rows = await db.query.paystackEvents.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(paystackEvents.processedAt)],
    limit: clampLimit(filters.limit),
  });

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    eventType: row.eventType,
    reference: row.reference,
    processedAt: row.processedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}
