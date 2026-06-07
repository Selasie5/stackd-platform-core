import type { Request, Response } from 'express';
import type { SessionData } from '@/auth/types';
import type { GraphQLContext } from '@/graphql/context';

export function createMockContext(session: SessionData | null = null): GraphQLContext {
  const cookies: Record<string, string> = {};
  const req = {
    cookies,
    ip: '127.0.0.1',
    get: (name: string) => (name.toLowerCase() === 'user-agent' ? 'vitest' : undefined),
  } as unknown as Request;

  const res = {
    cookie: () => undefined,
    clearCookie: () => undefined,
  } as unknown as Response;

  return { req, res, session };
}

export function createMockContextWithCookie(
  sessionToken: string,
  session: SessionData,
  cookieName: string,
): GraphQLContext {
  const ctx = createMockContext(session);
  ctx.req.cookies[cookieName] = sessionToken;
  return ctx;
}
