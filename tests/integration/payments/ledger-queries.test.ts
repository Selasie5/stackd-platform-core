import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { executeGql } from '../../helpers/graphql';
import { createKycApprovedBrand } from '../../helpers/factories';
import { db } from '@/db/client';
import { brandWallets, walletTransactions } from '@/db/schema/index';
import { creditFunds } from '@/opportunities/wallet.service';

describe('ledger queries', () => {
  it('returns brand wallet transactions after funding', async () => {
    const brand = await createKycApprovedBrand();
    const brandId = brand.user.brand!.id;

    await creditFunds(brandId, '7500.00', 'NGN', {
      referenceType: 'wallet_topup',
      referenceId: brandId,
      description: 'Manual test credit',
    });

    const wallet = await db.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });
    if (!wallet) throw new Error('Expected brand wallet');

    const txCount = await db.query.walletTransactions.findMany({
      where: eq(walletTransactions.brandId, brandId),
    });
    expect(txCount.length).toBeGreaterThan(0);

    const result = await executeGql<{
      myBrandWalletTransactions: Array<{ transactionType: string; amount: string }>;
    }>(
      `query {
        myBrandWalletTransactions(limit: 10) {
          transactionType
          amount
          currency
          balanceAfter
        }
      }`,
      { sessionToken: brand.sessionToken },
    );

    const rows = result.data?.myBrandWalletTransactions ?? [];
    expect(rows.some((row) => row.transactionType === 'credit' && row.amount === '7500.00')).toBe(
      true,
    );
  });
});
