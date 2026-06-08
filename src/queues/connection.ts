import { config } from '@/config/index';

/** BullMQ connection — use URL string to avoid ioredis version mismatch with project redis client. */
export function getQueueConnection() {
  return {
    url: config.REDIS_URL,
    maxRetriesPerRequest: null,
  } as const;
}
