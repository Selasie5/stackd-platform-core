import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { beforeAll } from 'vitest';
import { redisClient } from '@/queues/client';

const envTest = resolve(process.cwd(), '.env.test');
const envDefault = resolve(process.cwd(), '.env');

if (existsSync(envTest)) {
  loadEnv({ path: envTest, override: true });
} else {
  loadEnv({ path: envDefault, override: true });
}

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  await redisClient.ping();
});
