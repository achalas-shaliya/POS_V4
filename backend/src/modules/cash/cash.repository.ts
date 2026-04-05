import { prisma } from '../../config/database';
import { Prisma } from '../../generated/prisma/client';
import { RegisterStatus, CashMovementType } from '../../generated/prisma/enums';
import type { ListRegistersInput, ListMovementsInput } from './cash.schema';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Shared include shapes
// ---------------------------------------------------------------------------
const REGISTER_SUMMARY_INCLUDE = {
  outlet:    { select: { id: true, name: true } },
  openedBy:  { select: { id: true, fullName: true } },
  closedBy:  { select: { id: true, fullName: true } },
  _count:    { select: { movements: true } },
} satisfies Prisma.CashRegisterInclude;

const REGISTER_DETAIL_INCLUDE = {
  outlet:    { select: { id: true, name: true } },
  openedBy:  { select: { id: true, fullName: true } },
  closedBy:  { select: { id: true, fullName: true } },
  movements: {
    include: { createdBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CashRegisterInclude;

const MOVEMENT_INCLUDE = {
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.CashMovementInclude;

// ---------------------------------------------------------------------------
// Register reads
// ---------------------------------------------------------------------------

export const findRegisterById = (id: string) =>
  prisma.cashRegister.findUnique({ where: { id }, include: REGISTER_DETAIL_INCLUDE });

/** Find the single OPEN register for a given user (used to enforce uniqueness) */
export const findOpenRegisterByUser = (userId: string) =>
  prisma.cashRegister.findFirst({
    where: { openedById: userId, status: RegisterStatus.OPEN },
    include: REGISTER_SUMMARY_INCLUDE,
  });

/** Find any OPEN register for an outlet (to allow supervisor queries) */
export const findOpenRegisterByOutlet = (outletId: string) =>
  prisma.cashRegister.findFirst({
    where: { outletId, status: RegisterStatus.OPEN },
    include: REGISTER_SUMMARY_INCLUDE,
  });

export const listRegisters = (
  skip: number,
  take: number,
  filters: Pick<ListRegistersInput, 'outletId' | 'userId' | 'status' | 'fromDate' | 'toDate'>,
) => {
  const where: Prisma.CashRegisterWhereInput = {
    ...(filters.outletId && { outletId:    filters.outletId }),
    ...(filters.userId   && { openedById:  filters.userId }),
    ...(filters.status   && { status:      filters.status as RegisterStatus }),
    ...((filters.fromDate || filters.toDate) && {
      openedAt: {
        ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
        ...(filters.toDate   && { lte: new Date(filters.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.cashRegister.findMany({
      where,
      skip,
      take,
      include: REGISTER_SUMMARY_INCLUDE,
      orderBy: { openedAt: 'desc' },
    }),
    prisma.cashRegister.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Register writes
// ---------------------------------------------------------------------------

export const createRegisterInTx = (
  tx: Tx,
  data: {
    outletId:       string;
    openedById:     string;
    openingBalance: number;
  },
) =>
  tx.cashRegister.create({
    data: {
      outletId:       data.outletId,
      openedById:     data.openedById,
      openingBalance: data.openingBalance,
      status:         RegisterStatus.OPEN,
    },
    include: REGISTER_DETAIL_INCLUDE,
  });

export const closeRegisterInTx = (
  tx: Tx,
  id: string,
  data: {
    closedById:   string;
    expectedCash: number;
    actualCash:   number;
    difference:   number;
    closingNote?: string;
  },
) =>
  tx.cashRegister.update({
    where: { id },
    data: {
      status:       RegisterStatus.CLOSED,
      closedAt:     new Date(),
      closedById:   data.closedById,
      expectedCash: data.expectedCash,
      actualCash:   data.actualCash,
      difference:   data.difference,
      closingNote:  data.closingNote,
    },
    include: REGISTER_DETAIL_INCLUDE,
  });

// ---------------------------------------------------------------------------
// Movement writes
// ---------------------------------------------------------------------------

export const createMovementInTx = (
  tx: Tx,
  data: {
    registerId:   string;
    createdById:  string;
    type:         CashMovementType;
    amount:       number;
    note?:        string;
    referenceId?: string;
  },
) =>
  tx.cashMovement.create({
    data: {
      registerId:  data.registerId,
      createdById: data.createdById,
      type:        data.type,
      amount:      data.amount,
      note:        data.note,
      referenceId: data.referenceId,
    },
    include: MOVEMENT_INCLUDE,
  });

// ---------------------------------------------------------------------------
// Movement reads
// ---------------------------------------------------------------------------

export const listMovements = (
  registerId: string,
  skip: number,
  take: number,
  type?: CashMovementType,
) => {
  const where: Prisma.CashMovementWhereInput = {
    registerId,
    ...(type && { type }),
  };

  return prisma.$transaction([
    prisma.cashMovement.findMany({
      where,
      skip,
      take,
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cashMovement.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Aggregation — compute expected cash total for a register
// ---------------------------------------------------------------------------
export const computeExpectedCash = async (registerId: string): Promise<number> => {
  const rows = await prisma.$queryRaw<{ expectedCash: number }[]>`
    SELECT COALESCE(
      SUM(
        CASE
          WHEN cm.type IN ('OPENING_FLOAT', 'SALE_CASH', 'REPAIR_CASH', 'CASH_IN')
          THEN cm.amount
          WHEN cm.type = 'CASH_OUT'
          THEN -cm.amount
          ELSE 0
        END
      ),
      0
    ) AS expectedCash
    FROM cash_movements cm
    WHERE cm.register_id = ${registerId}
  `;

  return parseFloat(Number(rows[0]?.expectedCash ?? 0).toFixed(2));
};

/** Same computation but executed inside a Prisma transaction */
export const computeExpectedCashInTx = async (
  tx: Tx,
  registerId: string,
): Promise<number> => {
  const rows = await tx.$queryRaw<{ expectedCash: number }[]>`
    SELECT COALESCE(
      SUM(
        CASE
          WHEN cm.type IN ('OPENING_FLOAT', 'SALE_CASH', 'REPAIR_CASH', 'CASH_IN')
          THEN cm.amount
          WHEN cm.type = 'CASH_OUT'
          THEN -cm.amount
          ELSE 0
        END
      ),
      0
    ) AS expectedCash
    FROM cash_movements cm
    WHERE cm.register_id = ${registerId}
  `;

  return parseFloat(Number(rows[0]?.expectedCash ?? 0).toFixed(2));
};
