import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { allTypeDefs } from '@/graphql/typeDefs/index';
import { resolvers } from '@/graphql/resolvers/index';
import type { GraphQLContext } from '@/graphql/context';
import { SESSION_COOKIE_NAME } from '@/auth/constants';
import { getSession } from '@/auth/session.service';
import { paystackWebhookHandler } from '@/routes/paystack-webhook';
import { redisClient } from '@/queues/client';
import { db } from '@/db/client';
import { sql } from 'drizzle-orm';
import { generateSignature } from '@/utils/cloudinary';
import { config } from '@/config';

export type { GraphQLContext } from '@/graphql/context';

export const app = express();

export async function startServer(): Promise<http.Server> {
  app.use(cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }));
  app.use(cookieParser());

  app.post('/webhooks/paystack', express.raw({ type: 'application/json' }), paystackWebhookHandler);

  const httpServer = http.createServer(app);

  const server = new ApolloServer<GraphQLContext>({
    typeDefs: allTypeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/upload-signature', (_req, res) => {
    try {
      const signatureData = generateSignature('spleenet/brands/logos');
      res.json(signatureData);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate signature' });
    }
  });

  app.get('/health/ready', async (_req, res) => {
    const checks: Record<string, string> = {};

    try {
      const pong = await redisClient.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks.redis = 'error';
    }

    try {
      await db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    const ready = Object.values(checks).every((status) => status === 'ok');
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(server, {
      context: async ({ req, res }): Promise<GraphQLContext> => {
        const token = req.cookies?.[SESSION_COOKIE_NAME];
        const session = token ? await getSession(token) : null;
        return { req, res, session };
      },
    }),
  );

  return httpServer;
}
