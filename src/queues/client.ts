import Redis from 'ioredis';
import { config } from '@/config/index';

export const redisClient = new Redis(config.REDIS_URL);

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});
