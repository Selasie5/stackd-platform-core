import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { allTypeDefs } from '@/graphql/typeDefs/index';
import { resolvers } from '@/graphql/resolvers/index';
import type { GraphQLContext } from '@/graphql/context';
import { SESSION_COOKIE_NAME } from '@/auth/constants';
import { getSession } from '@/auth/session.service';

export type { GraphQLContext } from '@/graphql/context';

export const app = express();

export async function startServer(): Promise<http.Server> {
  app.use(cookieParser());

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
