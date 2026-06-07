import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireKycApproved, requireBrandWriteAccess, requireCreatorApplyAccess } from '@/kyc/guards';
import { createMockContext } from '../../helpers/context';
import type { SessionData } from '@/auth/types';

vi.mock('@/kyc/kyc.service', () => ({
  getKycStatusForUser: vi.fn(),
}));

import { getKycStatusForUser } from '@/kyc/kyc.service';

const brandSession: SessionData = {
  userId: 'user-1',
  role: 'brand',
  email: 'brand@test.com',
  emailVerified: true,
  brandId: 'brand-1',
};

const creatorSession: SessionData = {
  userId: 'user-2',
  role: 'creator',
  email: 'creator@test.com',
  emailVerified: true,
  creatorId: 'creator-1',
};

describe('kyc guards', () => {
  beforeEach(() => {
    vi.mocked(getKycStatusForUser).mockReset();
  });

  it('requireKycApproved throws KYC_NOT_APPROVED when not approved', async () => {
    vi.mocked(getKycStatusForUser).mockResolvedValue('pending_review');
    const ctx = createMockContext(brandSession);
    await expect(requireKycApproved(ctx)).rejects.toMatchObject({
      extensions: { code: 'KYC_NOT_APPROVED' },
    });
  });

  it('requireKycApproved passes when approved', async () => {
    vi.mocked(getKycStatusForUser).mockResolvedValue('approved');
    const ctx = createMockContext(brandSession);
    await expect(requireKycApproved(ctx)).resolves.toEqual(brandSession);
  });

  it('requireBrandWriteAccess requires brand role', async () => {
    vi.mocked(getKycStatusForUser).mockResolvedValue('approved');
    const ctx = createMockContext(creatorSession);
    await expect(requireBrandWriteAccess(ctx)).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });

  it('requireCreatorApplyAccess requires creator role', async () => {
    vi.mocked(getKycStatusForUser).mockResolvedValue('approved');
    const ctx = createMockContext(brandSession);
    await expect(requireCreatorApplyAccess(ctx)).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });
});
