import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { config } from '@/config/index';
import { typeDefs } from '@/graphql/typeDefs/index';
import { resolvers } from '@/graphql/resolvers/index';
import type { SessionData } from '@/auth/types';

export interface GraphQLContext {
  session: SessionData | null;
}

export const app = express();

export async function startServer(): Promise<http.Server> {
  app.use(cookieParser());

  const httpServer = http.createServer(app);

  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        void req.cookies?.[config.SESSION_COOKIE_NAME];
        return { session: null };
      },
    }),
  );

  return httpServer;
}
