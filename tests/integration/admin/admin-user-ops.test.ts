import { describe, it, expect, beforeAll } from 'vitest';
import { executeGql } from '../../helpers/graphql';
import { createVerifiedCreator, ensureAdminSession } from '../../helpers/factories';
import { login } from '@/auth/auth.service';

describe('admin user ops', () => {
  let adminSession: Awaited<ReturnType<typeof ensureAdminSession>>;

  beforeAll(async () => {
    adminSession = await ensureAdminSession();
  });

  it(
    'suspends user and blocks login',
    async () => {
      const creator = await createVerifiedCreator();

      const suspendResult = await executeGql<{
        updateUserStatus: { status: string };
      }>(
        `mutation($userId: ID!, $status: UserStatus!, $reason: String) {
          updateUserStatus(userId: $userId, status: $status, reason: $reason) {
            status
          }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: {
            userId: creator.user.id,
            status: 'suspended',
            reason: 'Policy violation',
          },
        },
      );

      expect(suspendResult.errors).toBeUndefined();
      expect(suspendResult.data?.updateUserStatus.status).toBe('suspended');

      await expect(login({ email: creator.email, password: creator.password })).rejects.toThrow();
    },
    60_000,
  );

  it(
    'prevents admin from suspending themselves',
    async () => {
      const result = await executeGql(
        `mutation($userId: ID!, $status: UserStatus!) {
          updateUserStatus(userId: $userId, status: $status) { id }
        }`,
        {
          sessionToken: adminSession.sessionToken,
          variables: {
            userId: adminSession.user.id,
            status: 'suspended',
          },
        },
      );
      expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    },
    60_000,
  );
});
