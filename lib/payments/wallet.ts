// lib/payments/wallet.ts
// Wallet operations — always write ledger entries atomically with balance changes

import { prisma } from "@/lib/prisma";
import { WalletTransactionReason, WalletTransactionType } from "@/app/generated/prisma";
import { Decimal } from "@/app/generated/prisma/runtime/library";

// ----------------------------------------------------------------
// Get or create wallet for a user
// ----------------------------------------------------------------
export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, currency: "KES" },
  });
}

// ----------------------------------------------------------------
// Get wallet balance
// ----------------------------------------------------------------
export async function getWalletBalance(
  userId: string
): Promise<{ walletId: string; balance: number; currency: string }> {
  const wallet = await getOrCreateWallet(userId);
  return {
    walletId: wallet.id,
    balance: Number(wallet.balance),
    currency: wallet.currency,
  };
}

// ----------------------------------------------------------------
// Credit wallet (top-up, earnings, refund, promo)
// ----------------------------------------------------------------
export async function creditWallet({
  userId,
  amount,
  reason,
  referenceId,
  description,
  metadata,
}: {
  userId: string;
  amount: number;
  reason: WalletTransactionReason;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  if (amount <= 0) throw new Error("Credit amount must be positive");

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error(`Wallet not found for user ${userId}`);

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + amount;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: new Decimal(balanceAfter) },
    });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.CREDIT,
        reason,
        amount: new Decimal(amount),
        balanceBefore: new Decimal(balanceBefore),
        balanceAfter: new Decimal(balanceAfter),
        referenceId,
        description,
        metadata: metadata as any,
      },
    });
  });
}

// ----------------------------------------------------------------
// Debit wallet (payment, commission, payout)
// ----------------------------------------------------------------
export async function debitWallet({
  userId,
  amount,
  reason,
  referenceId,
  description,
  metadata,
}: {
  userId: string;
  amount: number;
  reason: WalletTransactionReason;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  if (amount <= 0) throw new Error("Debit amount must be positive");

  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE equivalent via findUnique inside tx
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error(`Wallet not found for user ${userId}`);

    const balanceBefore = Number(wallet.balance);
    if (balanceBefore < amount) {
      throw new Error(
        `Insufficient wallet balance: ${balanceBefore} KES, needed ${amount} KES`
      );
    }

    const balanceAfter = balanceBefore - amount;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: new Decimal(balanceAfter) },
    });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.DEBIT,
        reason,
        amount: new Decimal(amount),
        balanceBefore: new Decimal(balanceBefore),
        balanceAfter: new Decimal(balanceAfter),
        referenceId,
        description,
        metadata: metadata as any,
      },
    });
  });
}

// ----------------------------------------------------------------
// Check sufficient balance
// ----------------------------------------------------------------
export async function hasSufficientBalance(
  userId: string,
  amount: number
): Promise<boolean> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return false;
  return Number(wallet.balance) >= amount;
}

// ----------------------------------------------------------------
// Get ledger (paginated)
// ----------------------------------------------------------------
export async function getWalletLedger(
  userId: string,
  { page = 1, pageSize = 20 } = {}
) {
  const wallet = await getOrCreateWallet(userId);

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
  ]);

  return {
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      reason: t.reason,
      amount: Number(t.amount),
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
      description: t.description,
      referenceId: t.referenceId,
      createdAt: t.createdAt,
    })),
    pagination: {
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    },
  };
}
