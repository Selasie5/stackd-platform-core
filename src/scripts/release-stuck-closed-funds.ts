import 'dotenv/config';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { brandWallets, contests, cpmDeals, payments, ugcOrders, walletTransactions } from '@/db/schema/index';

function parseAmount(value: string): number {
  return parseFloat(value);
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

async function getTotalEscrowForOpportunity(opportunityId: string): Promise<number> {
  const rows = await db.query.payments.findMany({
    where: and(
      eq(payments.opportunityId, opportunityId),
      inArray(payments.status, ['in_escrow', 'ready_for_payout', 'paid', 'disputed']),
    ),
    columns: { amount: true },
  });
  return rows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
}

async function releaseStuckFunds(
  brandId: string,
  amount: string,
  currency: 'NGN' | 'GHS' | 'USD',
  referenceType: 'ugc_order' | 'cpm_deal' | 'contest',
  referenceId: string,
  title: string,
): Promise<void> {
  const releaseAmount = parseAmount(amount);
  if (releaseAmount <= 0) return;

  await db.transaction(async (tx) => {
    const wallet = await tx.query.brandWallets.findFirst({
      where: eq(brandWallets.brandId, brandId),
    });

    if (!wallet) {
      console.warn(`  ⚠  No wallet found for brand ${brandId}, skipping`);
      return;
    }

    const available = parseAmount(wallet.availableBalance);
    const reserved = parseAmount(wallet.reservedBalance);
    const newAvailable = formatAmount(available + releaseAmount);
    const newReserved = formatAmount(Math.max(0, reserved - releaseAmount));

    await tx
      .update(brandWallets)
      .set({
        availableBalance: newAvailable,
        reservedBalance: newReserved,
        updatedAt: new Date(),
      })
      .where(eq(brandWallets.id, wallet.id));

    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      brandId,
      transactionType: 'release',
      amount: formatAmount(releaseAmount),
      currency,
      balanceBefore: wallet.availableBalance,
      balanceAfter: newAvailable,
      reservedBefore: wallet.reservedBalance,
      reservedAfter: newReserved,
      description: `Release stuck reserved funds for closed campaign: ${title}`,
      referenceType,
      referenceId,
    });

    console.log(
      `  ✓ Released ${currency} ${formatAmount(releaseAmount)} to brand ${brandId} (available: ${wallet.availableBalance} → ${newAvailable}, reserved: ${wallet.reservedBalance} → ${newReserved})`,
    );
  });
}

async function processOpportunities() {
  let totalReleased = 0;
  let totalSkipped = 0;

  // ── UGC Orders ──────────────────────────────────────────────
  const ugcRows = await db.query.ugcOrders.findMany({
    where: and(eq(ugcOrders.status, 'closed'), isNotNull(ugcOrders.reservedAt)),
    columns: { id: true, brandId: true, totalBudget: true, currency: true, title: true },
  });

  for (const row of ugcRows) {
    const escrow = await getTotalEscrowForOpportunity(row.id);
    if (escrow > 0) {
      console.log(`  → Skipping UGC order "${row.title}" — has ${row.currency} ${formatAmount(escrow)} in escrow`);
      totalSkipped++;
      continue;
    }
    console.log(`  → Releasing funds for closed UGC order "${row.title}"`);
    await releaseStuckFunds(
      row.brandId,
      row.totalBudget,
      row.currency as 'NGN' | 'GHS' | 'USD',
      'ugc_order',
      row.id,
      row.title,
    );
    totalReleased++;
  }

  // ── CPM Deals ───────────────────────────────────────────────
  const cpmRows = await db.query.cpmDeals.findMany({
    where: and(eq(cpmDeals.status, 'closed'), isNotNull(cpmDeals.reservedAt)),
    columns: { id: true, brandId: true, maxCampaignBudget: true, currency: true, title: true },
  });

  for (const row of cpmRows) {
    const escrow = await getTotalEscrowForOpportunity(row.id);
    if (escrow > 0) {
      console.log(`  → Skipping CPM deal "${row.title}" — has ${row.currency} ${formatAmount(escrow)} in escrow`);
      totalSkipped++;
      continue;
    }
    console.log(`  → Releasing funds for closed CPM deal "${row.title}"`);
    await releaseStuckFunds(
      row.brandId,
      row.maxCampaignBudget,
      row.currency as 'NGN' | 'GHS' | 'USD',
      'cpm_deal',
      row.id,
      row.title,
    );
    totalReleased++;
  }

  // ── Contests ────────────────────────────────────────────────
  const contestRows = await db.query.contests.findMany({
    where: and(eq(contests.status, 'closed'), isNotNull(contests.reservedAt)),
    columns: { id: true, brandId: true, totalContestBudget: true, currency: true, title: true },
  });

  for (const row of contestRows) {
    const escrow = await getTotalEscrowForOpportunity(row.id);
    if (escrow > 0) {
      console.log(`  → Skipping contest "${row.title}" — has ${row.currency} ${formatAmount(escrow)} in escrow`);
      totalSkipped++;
      continue;
    }
    console.log(`  → Releasing funds for closed contest "${row.title}"`);
    await releaseStuckFunds(
      row.brandId,
      row.totalContestBudget,
      row.currency as 'NGN' | 'GHS' | 'USD',
      'contest',
      row.id,
      row.title,
    );
    totalReleased++;
  }

  console.log(`\nDone. Released ${totalReleased} campaign(s), skipped ${totalSkipped} campaign(s) with escrow.`);
}

async function main() {
  console.log('Releasing stuck reserved funds for closed campaigns with no escrow allocations…\n');
  await processOpportunities();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
