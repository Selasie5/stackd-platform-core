import { config } from '@/config/index';
import {
  login,
  logout,
  registerBrand,
  registerCreator,
  resendVerificationEmail,
  verifyEmail,
  getMe,
} from '@/auth/auth.service';
import { requestPasswordReset, resetPassword } from '@/auth/password-reset.service';
import { setSessionCookie, clearSessionCookie } from '@/auth/cookies';
import { requireAuth } from '@/auth/guards';
import type { GraphQLContext } from '@/graphql/context';

function requestMeta(ctx: GraphQLContext) {
  return {
    ipAddress: ctx.req.ip,
    userAgent: ctx.req.get('user-agent') ?? undefined,
  };
}

export const authResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getMe(session.userId);
    },
  },
  Mutation: {
    registerBrand: async (_: unknown, { input }: { input: unknown }) => {
      return registerBrand(input);
    },
    registerCreator: async (_: unknown, { input }: { input: unknown }) => {
      return registerCreator(input);
    },
    login: async (_: unknown, { input }: { input: unknown }, ctx: GraphQLContext) => {
      const result = await login(input, requestMeta(ctx));
      setSessionCookie(ctx.res, result.token);
      return { user: result.user };
    },
    logout: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const token = ctx.req.cookies?.[config.SESSION_COOKIE_NAME];
      await logout(token);
      clearSessionCookie(ctx.res);
      return true;
    },
    verifyEmail: async (_: unknown, { token }: { token: string }, ctx: GraphQLContext) => {
      const result = await verifyEmail(token, requestMeta(ctx));
      setSessionCookie(ctx.res, result.token);
      return { user: result.user };
    },
    resendVerificationEmail: async (_: unknown, { email }: { email: string }) => {
      return resendVerificationEmail(email);
    },
    requestPasswordReset: async (_: unknown, { email }: { email: string }) => {
      return requestPasswordReset(email);
    },
    resetPassword: async (
      _: unknown,
      { email, otp, newPassword }: { email: string; otp: string; newPassword: string },
    ) => {
      return resetPassword({ email, otp, newPassword });
    },
  },
};
