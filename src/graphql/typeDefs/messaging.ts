export const messagingTypeDefs = `#graphql
  enum MessageReferenceType {
    ugc_order
    cpm_deal
    contest
    dispute
  }

  type Message {
    id: ID!
    senderId: ID!
    recipientId: ID!
    referenceType: MessageReferenceType
    referenceId: ID
    body: String!
    attachmentUrl: String
    isRead: Boolean!
    readAt: String
    createdAt: String!
  }

  input SendMessageInput {
    recipientId: ID!
    body: String!
    referenceType: MessageReferenceType
    referenceId: ID
    attachmentUrl: String
  }

  extend type Query {
    conversation(
      referenceType: MessageReferenceType!
      referenceId: ID!
      limit: Int
    ): [Message!]!
  }

  extend type Mutation {
    sendMessage(input: SendMessageInput!): Message!
    markMessagesRead(referenceType: MessageReferenceType!, referenceId: ID!): Int!
  }
`;
