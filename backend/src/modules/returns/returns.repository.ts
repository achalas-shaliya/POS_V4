import { prisma } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { ReturnStatus, ReturnReason } from '../../generated/prisma/enums';
import type { ListReturnsInput } from './returns.schema';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Shared include shapes
// ---------------------------------------------------------------------------
const RETURN_SUMMARY_INCLUDE = {
  outlet:      { select: { id: true, name: true } },
  sale:        { select: { id: true, receiptNo: true } },
  createdBy:   { select: { id: true, fullName: true } },
  processedBy: { select: { id: true, fullName: true } },
  _count:      { select: { items: true } },
} satisfies Prisma.SaleReturnInclude;

const RETURN_DETAIL_INCLUDE = {
  outlet:      { select: { id: true, name: true } },
  sale:        { select: { id: true, receiptNo: true, total: true } },
  createdBy:   { select: { id: true, fullName: true } },
  processedBy: { select: { id: true, fullName: true } },
  items: {
    include: {
      item:     { select: { id: true, sku: true, name: true } },
      saleItem: { select: { id: true, quantity: true, unitPrice: true } },
    },
    orderBy: { item: { name: 'asc' as const } },
  },
} satisfies Prisma.SaleReturnInclude;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const findReturnById = (id: string) =>
  prisma.saleReturn.findUnique({ where: { id }, include: RETURN_DETAIL_INCLUDE });

export const findReturnByNo = (returnNo: string) =>
  prisma.saleReturn.findUnique({ where: { returnNo }, include: RETURN_DETAIL_INCLUDE });

export const listReturns = (
  skip: number,
  take: number,
  filters: Pick<ListReturnsInput, 'status' | 'outletId' | 'saleId' | 'fromDate' | 'toDate'>,
) => {
  const where: Prisma.SaleReturnWhereInput = {
    ...(filters.status   && { status:   filters.status as ReturnStatus }),
    ...(filters.outletId && { outletId: filters.outletId }),
    ...(filters.saleId   && { saleId:   filters.saleId }),
    ...((filters.fromDate || filters.toDate) && {
      createdAt: {
        ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
        ...(filters.toDate   && { lte: new Date(filters.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.saleReturn.findMany({
      where,
      skip,
      take,
      include: RETURN_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.saleReturn.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createReturnInTx = (
  tx: Tx,
  data: {
    returnNo:    string;
    saleId:      string;
    outletId:    string;
    reason:      ReturnReason;
    note?:       string;
    createdById: string;
    items: {
      saleItemId: string;
      itemId:     string;
      quantity:   number;
      unitPrice:  number;
      subtotal:   number;
    }[];
    refundAmount: number;
  },
) =>
  tx.saleReturn.create({
    data: {
      returnNo:    data.returnNo,
      saleId:      data.saleId,
      outletId:    data.outletId,
      reason:      data.reason,
      note:        data.note,
      createdById: data.createdById,
      refundAmount: data.refundAmount,
      items: { create: data.items },
    },
    include: RETURN_DETAIL_INCLUDE,
  });

export const approveReturnInTx = (
  tx: Tx,
  id: string,
  processedById: string,
) =>
  tx.saleReturn.update({
    where: { id },
    data: {
      status:       ReturnStatus.APPROVED,
      processedById,
      processedAt:  new Date(),
    },
  });

export const rejectReturnInTx = (
  tx: Tx,
  id: string,
  processedById: string,
  note?: string,
) =>
  tx.saleReturn.update({
    where: { id },
    data: {
      status:       ReturnStatus.REJECTED,
      processedById,
      processedAt:  new Date(),
      ...(note && { note }),
    },
  });
