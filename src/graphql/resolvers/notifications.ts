import { requireAuth } from '@/auth/guards';
import { requireAdmin } from '@/kyc/guards';
import type { GraphQLContext } from '@/graphql/context';
import { getAdminActionCounts } from '@/notifications/admin.service';
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/notifications/notification.service';
import { registerDeviceToken, removeDeviceToken } from '@/notifications/device-token.service';

export const notificationsResolvers = {
  Notification: {
    readAt: (parent: { readAt: Date | null }) => parent.readAt?.toISOString() ?? null,
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
  Query: {
    myNotifications: async (
      _: unknown,
      { unreadOnly }: { unreadOnly?: boolean },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return listMyNotifications(session.userId, unreadOnly ?? false);
    },
    unreadNotificationCount: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return getUnreadNotificationCount(session.userId);
    },
    adminActionCounts: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAdmin(ctx);
      return getAdminActionCounts(session.userId);
    },
  },
  Mutation: {
    markNotificationRead: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return markNotificationRead(session.userId, id);
    },
    markAllNotificationsRead: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return markAllNotificationsRead(session.userId);
    },
    registerDeviceToken: async (
      _: unknown,
      { token, platform }: { token: string; platform: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return registerDeviceToken(session.userId, token, platform);
    },
    removeDeviceToken: async (_: unknown, { token }: { token: string }, ctx: GraphQLContext) => {
      const session = requireAuth(ctx);
      return removeDeviceToken(session.userId, token);
    },
  },
};
