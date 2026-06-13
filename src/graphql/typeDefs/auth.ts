export const authTypeDefs = `#graphql
  enum UserRole {
    admin
    brand
    creator
  }

  enum UserStatus {
    active
    suspended
    pending
    banned
  }

  type User {
    id: ID!
    email: String!
    role: UserRole!
    status: UserStatus!
    emailVerified: Boolean!
    brand: Brand
    creator: Creator
  }

  type Brand {
    id: ID!
    brandName: String!
    kycStatus: String!
  }

  type Creator {
    id: ID!
    fullName: String!
    kycStatus: String!
  }

  type AuthPayload {
    user: User!
  }

  type MessagePayload {
    message: String!
    user: User
  }

  input RegisterBrandInput {
    email: String!
    password: String!
    brandName: String!
    country: String!
    contactName: String!
    currency: String
    industry: String!
    city: String!
    description: String!
    website: String
    logoUrl: String
  }

  input RegisterCreatorInput {
    email: String!
    password: String!
    fullName: String!
    country: String
    school: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  extend type Query {
    me: User
  }

  extend type Mutation {
    registerBrand(input: RegisterBrandInput!): MessagePayload!
    registerCreator(input: RegisterCreatorInput!): MessagePayload!
    login(input: LoginInput!): AuthPayload!
    logout: Boolean!
    verifyEmail(token: String!): AuthPayload!
    resendVerificationEmail(email: String!): Boolean!
    requestPasswordReset(email: String!): Boolean!
    resetPassword(email: String!, otp: String!, newPassword: String!): Boolean!
  }
`;
