import type { GraphQLContext } from '@/graphql/context';
import { requireAuth } from '@/auth/guards';
import {
  getConversation,
  markMessagesRead,
  sendMessage,
} from '@/messaging/message.service';
import type { MessageReferenceType } from '@/messaging/guards';

export const messagingResolvers = {
  Query: {
    conversation: async (
      _: unknown,
      {
        referenceType,
        referenceId,
        limit,
      }: {
        referenceType: MessageReferenceType;
        referenceId: string;
        limit?: number;
      },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return getConversation(session, referenceType, referenceId, limit);
    },
  },
  Mutation: {
    sendMessage: async (
      _: unknown,
      { input }: { input: Record<string, unknown> },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return sendMessage(session, input);
    },
    markMessagesRead: async (
      _: unknown,
      {
        referenceType,
        referenceId,
      }: { referenceType: MessageReferenceType; referenceId: string },
      ctx: GraphQLContext,
    ) => {
      const session = requireAuth(ctx);
      return markMessagesRead(session, referenceType, referenceId);
    },
  },
};
