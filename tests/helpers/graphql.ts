import { ApolloServer } from '@apollo/server';
import { allTypeDefs } from '@/graphql/typeDefs/index';
import { resolvers } from '@/graphql/resolvers/index';
import type { GraphQLContext } from '@/graphql/context';
import type { SessionData } from '@/auth/types';
import { getSession } from '@/auth/session.service';
import { SESSION_COOKIE_NAME } from '@/auth/constants';
import { createMockContext } from './context';

let server: ApolloServer<GraphQLContext> | null = null;

export async function getTestServer(): Promise<ApolloServer<GraphQLContext>> {
  if (!server) {
    server = new ApolloServer<GraphQLContext>({
      typeDefs: allTypeDefs,
      resolvers,
    });
    await server.start();
  }
  return server;
}

export interface ExecuteGqlOptions {
  sessionToken?: string;
  session?: SessionData | null;
  variables?: Record<string, unknown>;
}

export async function executeGql<T = Record<string, unknown>>(
  query: string,
  options: ExecuteGqlOptions = {},
): Promise<{ data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> }> {
  const apollo = await getTestServer();
  const ctx = createMockContext(options.session ?? null);

  if (options.sessionToken) {
    ctx.req.cookies[SESSION_COOKIE_NAME] = options.sessionToken;
    const resolved = await getSession(options.sessionToken);
    if (resolved) ctx.session = resolved;
  }

  const result = await apollo.executeOperation(
    { query, variables: options.variables },
    { contextValue: ctx },
  );

  if (result.body.kind === 'single') {
    return result.body.singleResult as {
      data?: T;
      errors?: Array<{ message: string; extensions?: { code?: string } }>;
    };
  }

  throw new Error('Unexpected GraphQL incremental response');
}

export function expectGqlError(
  result: { errors?: Array<{ extensions?: { code?: string } }> },
  code: string,
): void {
  const errorCode = result.errors?.[0]?.extensions?.code;
  if (errorCode !== code) {
    throw new Error(`Expected error code ${code}, got ${errorCode ?? 'none'}`);
  }
}
