import { prisma } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { PaymentEntityType } from '../../generated/prisma/enums';
import type { ListPaymentsInput } from './payment.schema';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Shared include — always expand legs and creator
// ---------------------------------------------------------------------------
const TX_INCLUDE = {
  legs: true,
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PaymentTransactionInclude;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const findTransactionById = (id: string) =>
  prisma.paymentTransaction.findUnique({ where: { id }, include: TX_INCLUDE });

export const findTransactionByTxNo = (txNo: string) =>
  prisma.paymentTransaction.findUnique({ where: { txNo }, include: TX_INCLUDE });

export const listTransactionsBySale = (saleId: string) =>
  prisma.paymentTransaction.findMany({
    where: { saleId },
    include: TX_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

export const listTransactionsByRepair = (repairJobId: string) =>
  prisma.paymentTransaction.findMany({
    where: { repairJobId },
    include: TX_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

export const listTransactions = (
  skip: number,
  take: number,
  filters: Pick<ListPaymentsInput, 'entityType' | 'fromDate' | 'toDate'>,
) => {
  const where: Prisma.PaymentTransactionWhereInput = {
    ...(filters.entityType && {
      entityType: filters.entityType as PaymentEntityType,
    }),
    ...((filters.fromDate || filters.toDate) && {
      createdAt: {
        ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
        ...(filters.toDate   && { lte: new Date(filters.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.paymentTransaction.findMany({
      where,
      skip,
      take,
      include: TX_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paymentTransaction.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

/** Sum of all payment amounts collected for a sale */
export const sumSalePayments = async (saleId: string): Promise<number> => {
  const agg = await prisma.paymentTransaction.aggregate({
    where: { saleId },
    _sum: { totalAmount: true },
  });
  return Number(agg._sum.totalAmount ?? 0);
};

/** Sum of all payment amounts collected for a repair job */
export const sumRepairPayments = async (repairJobId: string): Promise<number> => {
  const agg = await prisma.paymentTransaction.aggregate({
    where: { repairJobId },
    _sum: { totalAmount: true },
  });
  return Number(agg._sum.totalAmount ?? 0);
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Create a PaymentTransaction with its legs inside a Prisma transaction */
export const createTransactionInTx = (
  tx: Tx,
  data: {
    txNo: string;
    entityType: 'SALE' | 'REPAIR';
    saleId?: string;
    repairJobId?: string;
    totalAmount: number;
    totalChange: number;
    note?: string;
    createdById: string;
    legs: {
      method: 'CASH' | 'CARD';
      amount: number;
      change: number;
      reference?: string;
    }[];
  },
) =>
  tx.paymentTransaction.create({
    data: {
      txNo:        data.txNo,
      entityType:  data.entityType as PaymentEntityType,
      saleId:      data.saleId,
      repairJobId: data.repairJobId,
      totalAmount: data.totalAmount,
      totalChange: data.totalChange,
      note:        data.note,
      createdById: data.createdById,
      legs: { create: data.legs },
    },
    include: TX_INCLUDE,
  });

/** Recompute sum of payments for a repair inside a tx (for advancePaid sync) */
export const sumRepairPaymentsInTx = async (
  tx: Tx,
  repairJobId: string,
): Promise<number> => {
  const agg = await tx.paymentTransaction.aggregate({
    where: { repairJobId },
    _sum: { totalAmount: true },
  });
  return Number(agg._sum.totalAmount ?? 0);
};
