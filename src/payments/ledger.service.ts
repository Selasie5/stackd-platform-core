import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  payments,
  walletTopUps,
  walletTransactions,
  creatorWalletTransactions,
  withdrawals,
} from '@/db/schema/index';
import type { SessionData } from '@/auth/types';
import { paymentError } from '@/payments/errors';
import { formatCreatorWallet, getCreatorWallet } from '@/wallets/creator-wallet.service';
import { getMyBrandWallet } from '@/payments/wallet-funding.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export function formatBrandWalletTransaction(row: {
  id: string;
  walletId: string;
  brandId: string;
  transactionType: string;
  amount: string;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  reservedBefore: string;
  reservedAfter: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    walletId: row.walletId,
    brandId: row.brandId,
    transactionType: row.transactionType,
    amount: row.amount,
    currency: row.currency,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    reservedBefore: row.reservedBefore,
    reservedAfter: row.reservedAfter,
    description: row.description,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function formatWalletTopUp(row: {
  id: string;
  brandId: string;
  amount: string;
  currency: string;
  paystackReference: string;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    brandId: row.brandId,
    amount: row.amount,
    currency: row.currency,
    paystackReference: row.paystackReference,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function formatCreatorWalletTransaction(row: {
  id: string;
  walletId: string;
  creatorId: string;
  transactionType: string;
  amount: string;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    walletId: row.walletId,
    creatorId: row.creatorId,
    transactionType: row.transactionType,
    amount: row.amount,
    currency: row.currency,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    description: row.description,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function formatPayment(row: {
  id: string;
  creatorId: string;
  referenceType: string;
  referenceId: string;
  opportunityType: string;
  opportunityId: string;
  amount: string;
  currency: string;
  status: string;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    creatorId: row.creatorId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    opportunityType: row.opportunityType,
    opportunityId: row.opportunityId,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function formatWithdrawal(row: {
  id: string;
  creatorId: string;
  walletId: string;
  amount: string;
  currency: string;
  paystackReference: string;
  paystackStatus: string | null;
  status: string;
  failureReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creator?: { fullName: string } | null;
}) {
  return {
    id: row.id,
    creatorId: row.creatorId,
    creatorName: row.creator?.fullName ?? null,
    walletId: row.walletId,
    amount: row.amount,
    currency: row.currency,
    paystackReference: row.paystackReference,
    paystackStatus: row.paystackStatus,
    status: row.status,
    failureReason: row.failureReason,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listBrandWalletTransactions(session: SessionData, limit?: number) {
  if (!session.brandId) {
    throw paymentError('WALLET_NOT_FOUND', 'Brand wallet not found');
  }

  const rows = await db.query.walletTransactions.findMany({
    where: eq(walletTransactions.brandId, session.brandId),
    orderBy: [desc(walletTransactions.createdAt)],
    limit: clampLimit(limit),
  });

  return rows.map(formatBrandWalletTransaction);
}

export async function listBrandWalletTopUps(
  session: SessionData,
  status?: 'pending' | 'completed' | 'failed',
) {
  if (!session.brandId) {
    throw paymentError('WALLET_NOT_FOUND', 'Brand wallet not found');
  }

  const rows = await db.query.walletTopUps.findMany({
    where: status
      ? and(eq(walletTopUps.brandId, session.brandId), eq(walletTopUps.status, status))
      : eq(walletTopUps.brandId, session.brandId),
    orderBy: [desc(walletTopUps.createdAt)],
    limit: DEFAULT_LIMIT,
  });

  return rows.map(formatWalletTopUp);
}

export async function getMyCreatorWallet(session: SessionData) {
  if (!session.creatorId) {
    throw paymentError('WALLET_NOT_FOUND', 'Creator wallet not found');
  }

  const wallet = await getCreatorWallet(session.creatorId);
  return formatCreatorWallet(wallet);
}

export async function listCreatorWalletTransactions(session: SessionData, limit?: number) {
  if (!session.creatorId) {
    throw paymentError('WALLET_NOT_FOUND', 'Creator wallet not found');
  }

  const rows = await db.query.creatorWalletTransactions.findMany({
    where: eq(creatorWalletTransactions.creatorId, session.creatorId),
    orderBy: [desc(creatorWalletTransactions.createdAt)],
    limit: clampLimit(limit),
  });

  return rows.map(formatCreatorWalletTransaction);
}

export async function listCreatorPayments(
  session: SessionData,
  status?: 'in_escrow' | 'awaiting_approval' | 'ready_for_payout' | 'paid' | 'disputed' | 'refunded',
) {
  if (!session.creatorId) {
    throw paymentError('WALLET_NOT_FOUND', 'Creator not found');
  }

  const rows = await db.query.payments.findMany({
    where: status
      ? and(eq(payments.creatorId, session.creatorId), eq(payments.status, status))
      : eq(payments.creatorId, session.creatorId),
    orderBy: [desc(payments.createdAt)],
    limit: DEFAULT_LIMIT,
  });

  return rows.map(formatPayment);
}

export async function listMyWithdrawals(
  session: SessionData,
  status?: 'pending' | 'processing' | 'completed' | 'failed',
) {
  if (!session.creatorId) {
    throw paymentError('WALLET_NOT_FOUND', 'Creator not found');
  }

  const rows = await db.query.withdrawals.findMany({
    where: status
      ? and(eq(withdrawals.creatorId, session.creatorId), eq(withdrawals.status, status))
      : eq(withdrawals.creatorId, session.creatorId),
    orderBy: [desc(withdrawals.createdAt)],
    limit: DEFAULT_LIMIT,
  });

  return rows.map(formatWithdrawal);
}

export async function listAdminWithdrawals(
  status?: 'pending' | 'processing' | 'completed' | 'failed',
  limit?: number,
) {
  const rows = await db.query.withdrawals.findMany({
    where: status ? eq(withdrawals.status, status) : undefined,
    with: { creator: { columns: { fullName: true } } },
    orderBy: [desc(withdrawals.createdAt)],
    limit: clampLimit(limit),
  });

  return rows.map((row) => formatWithdrawal(row));
}

export async function listAdminPayments(
  status?: 'in_escrow' | 'awaiting_approval' | 'ready_for_payout' | 'paid' | 'disputed' | 'refunded',
  limit?: number,
) {
  const rows = await db.query.payments.findMany({
    where: status ? eq(payments.status, status) : undefined,
    orderBy: [desc(payments.createdAt)],
    limit: clampLimit(limit),
  });

  return rows.map(formatPayment);
}

export { getMyBrandWallet };
