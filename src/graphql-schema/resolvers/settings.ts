import { requireAuth } from '@/auth/guards';
import { SESSION_COOKIE_NAME } from '@/auth/constants';
import type { GraphQLContext } from '@/graphql-schema/context';
import {
  getBrand,
  updateBrand,
  changePassword,
  getActiveSessions,
  revokeSessionById,
} from '@/auth/settings.service';
import { getCreatorProfile, updateCreatorProfile } from '@/auth/creator.service';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/notifications/preferences.service';

export const settingsResolvers = {
  Query: {
    brand: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getBrand(session.userId);
    },
    creator: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getCreatorProfile(session.userId);
    },
    activeSessions: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      const token = ctx.req.cookies?.[SESSION_COOKIE_NAME];
      return getActiveSessions(session.userId, token ?? '');
    },
    notificationPreferences: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getNotificationPreferences(session.userId);
    },
  },
  Mutation: {
    updateBrand: async (
      _: unknown,
      { input }: { input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return updateBrand(session.userId, input as Parameters<typeof updateBrand>[1]);
    },
    updateCreatorProfile: async (
      _: unknown,
      { input }: { input: unknown },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return updateCreatorProfile(session.userId, input);
    },
    changePassword: async (
      _: unknown,
      { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return changePassword(session.userId, currentPassword, newPassword);
    },
    revokeSession: async (
      _: unknown,
      { sessionId }: { sessionId: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return revokeSessionById(sessionId, session.userId);
    },
    updateNotificationPreferences: async (
      _: unknown,
      { input }: { input: Record<string, boolean> },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return updateNotificationPreferences(session.userId, input);
    },
  },
};
