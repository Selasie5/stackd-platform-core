import { describe, it, expect } from 'vitest';
import { executeGql, expectGqlError } from '../../helpers/graphql';
import { createVerifiedBrand } from '../../helpers/factories';
import { login } from '@/auth/auth.service';
import { getPasswordResetOtpForTest } from '@/auth/password-reset.service';

describe('password reset OTP', () => {
  it(
    'resets password with valid OTP and blocks old password',
    async () => {
      const brand = await createVerifiedBrand();
      const oldPassword = brand.password;
      const newPassword = 'NewPass456!';

      await executeGql(
        `mutation($email: String!) {
          requestPasswordReset(email: $email)
        }`,
        { variables: { email: brand.email } },
      );

      const otp = getPasswordResetOtpForTest(brand.email);
      expect(otp).toMatch(/^\d{6}$/);

      const resetResult = await executeGql<{ resetPassword: boolean }>(
        `mutation($email: String!, $otp: String!, $newPassword: String!) {
          resetPassword(email: $email, otp: $otp, newPassword: $newPassword)
        }`,
        {
          variables: { email: brand.email, otp, newPassword },
        },
      );
      expect(resetResult.data?.resetPassword).toBe(true);

      await expect(login({ email: brand.email, password: oldPassword })).rejects.toMatchObject({
        extensions: { code: 'INVALID_CREDENTIALS' },
      });

      const { token } = await login({ email: brand.email, password: newPassword });
      expect(token).toBeTruthy();
    },
    60_000,
  );

  it(
    'rejects invalid OTP',
    async () => {
      const brand = await createVerifiedBrand();

      await executeGql(
        `mutation($email: String!) { requestPasswordReset(email: $email) }`,
        { variables: { email: brand.email } },
      );

      const result = await executeGql(
        `mutation($email: String!, $otp: String!, $newPassword: String!) {
          resetPassword(email: $email, otp: $otp, newPassword: $newPassword)
        }`,
        {
          variables: { email: brand.email, otp: '000000', newPassword: 'NewPass456!' },
        },
      );
      expectGqlError(result, 'INVALID_OTP');
    },
    60_000,
  );

  it(
    'returns true for unknown email without enumeration',
    async () => {
      const result = await executeGql<{ requestPasswordReset: boolean }>(
        `mutation($email: String!) { requestPasswordReset(email: $email) }`,
        { variables: { email: 'nobody@example.com' } },
      );
      expect(result.data?.requestPasswordReset).toBe(true);
    },
    60_000,
  );
});
