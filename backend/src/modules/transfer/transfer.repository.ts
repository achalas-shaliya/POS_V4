import { prisma } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { TransferStatus, LocationType } from '../../generated/prisma/enums';
import type { ListTransfersInput } from './transfer.schema';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Shared include
// ---------------------------------------------------------------------------
const TRANSFER_SUMMARY_INCLUDE = {
  requestedBy:  { select: { id: true, fullName: true } },
  dispatchedBy: { select: { id: true, fullName: true } },
  receivedBy:   { select: { id: true, fullName: true } },
  _count:       { select: { items: true } },
} satisfies Prisma.StockTransferInclude;

const TRANSFER_DETAIL_INCLUDE = {
  requestedBy:  { select: { id: true, fullName: true } },
  dispatchedBy: { select: { id: true, fullName: true } },
  receivedBy:   { select: { id: true, fullName: true } },
  items: {
    include: {
      item: { select: { id: true, sku: true, name: true, unit: true } },
    },
    orderBy: { item: { name: 'asc' as const } },
  },
} satisfies Prisma.StockTransferInclude;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const findTransferById = (id: string) =>
  prisma.stockTransfer.findUnique({ where: { id }, include: TRANSFER_DETAIL_INCLUDE });

export const findTransferByNo = (transferNo: string) =>
  prisma.stockTransfer.findUnique({ where: { transferNo }, include: TRANSFER_DETAIL_INCLUDE });

export const listTransfers = (
  skip: number,
  take: number,
  filters: Pick<ListTransfersInput, 'status' | 'fromId' | 'toId' | 'fromDate' | 'toDate'>,
) => {
  const where: Prisma.StockTransferWhereInput = {
    ...(filters.status && { status: filters.status as TransferStatus }),
    ...(filters.fromId && { fromId: filters.fromId }),
    ...(filters.toId   && { toId:   filters.toId }),
    ...((filters.fromDate || filters.toDate) && {
      createdAt: {
        ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
        ...(filters.toDate   && { lte: new Date(filters.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.stockTransfer.findMany({
      where,
      skip,
      take,
      include: TRANSFER_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockTransfer.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createTransferInTx = (
  tx: Tx,
  data: {
    transferNo:    string;
    fromType:      LocationType;
    fromId:        string;
    toType:        LocationType;
    toId:          string;
    note?:         string;
    requestedById: string;
    items: { itemId: string; quantity: number }[];
  },
) =>
  tx.stockTransfer.create({
    data: {
      transferNo:    data.transferNo,
      fromType:      data.fromType,
      fromId:        data.fromId,
      toType:        data.toType,
      toId:          data.toId,
      note:          data.note,
      requestedById: data.requestedById,
      items:         { create: data.items },
    },
    include: TRANSFER_DETAIL_INCLUDE,
  });

export const dispatchTransferInTx = (
  tx: Tx,
  id: string,
  dispatchedById: string,
) =>
  tx.stockTransfer.update({
    where: { id },
    data: {
      status:        TransferStatus.DISPATCHED,
      dispatchedAt:  new Date(),
      dispatchedById,
    },
  });

export const receiveTransferInTx = (
  tx: Tx,
  id: string,
  receivedById: string,
) =>
  tx.stockTransfer.update({
    where: { id },
    data: {
      status:      TransferStatus.RECEIVED,
      receivedAt:  new Date(),
      receivedById,
    },
  });

export const cancelTransferInTx = (tx: Tx, id: string) =>
  tx.stockTransfer.update({
    where: { id },
    data: { status: TransferStatus.CANCELLED },
  });

export const updateTransferItemReceivedQtyInTx = (
  tx: Tx,
  transferItemId: string,
  receivedQty: number,
) =>
  tx.stockTransferItem.update({
    where: { id: transferItemId },
    data:  { receivedQty },
  });

export const findTransferItemById = (id: string) =>
  prisma.stockTransferItem.findUnique({
    where: { id },
    include: { transfer: true, item: true },
  });
