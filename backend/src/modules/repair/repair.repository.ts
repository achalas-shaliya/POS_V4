import { prisma } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { RepairStatus, PaymentEntityType } from '../../generated/prisma/enums';
import type { UpdateRepairJobInput, ListRepairJobsInput } from './repair.schema';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Shared include shapes
// ---------------------------------------------------------------------------

const JOB_SUMMARY_INCLUDE = {
  outlet:     { select: { id: true, name: true } },
  customer:   { select: { id: true, name: true, phone: true } },
  technician: { select: { id: true, fullName: true } },
  _count:     { select: { parts: true, payments: true } },
} satisfies Prisma.RepairJobInclude;

const JOB_DETAIL_INCLUDE = {
  outlet:     { select: { id: true, name: true } },
  customer:   { select: { id: true, name: true, phone: true, email: true } },
  technician: { select: { id: true, fullName: true } },
  createdBy:  { select: { id: true, fullName: true } },
  parts: {
    include: { item: { select: { id: true, sku: true, name: true } } },
    orderBy: { addedAt: 'asc' as const },
  },
  payments: {
    include: { legs: true },
    orderBy: { createdAt: 'asc' as const },
  },
  statusLogs: {
    include: { changedBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.RepairJobInclude;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const findJobById = (id: string) =>
  prisma.repairJob.findUnique({ where: { id }, include: JOB_DETAIL_INCLUDE });

export const findJobByNo = (jobNo: string) =>
  prisma.repairJob.findUnique({ where: { jobNo }, include: JOB_DETAIL_INCLUDE });

export const listJobs = (
  skip: number,
  take: number,
  filters: Pick<
    ListRepairJobsInput,
    'outletId' | 'customerId' | 'technicianId' | 'status' | 'fromDate' | 'toDate'
  >,
) => {
  const where: Prisma.RepairJobWhereInput = {
    ...(filters.outletId     && { outletId:     filters.outletId }),
    ...(filters.customerId   && { customerId:   filters.customerId }),
    ...(filters.technicianId && { technicianId: filters.technicianId }),
    ...(filters.status       && { status:       filters.status as RepairStatus }),
    ...((filters.fromDate || filters.toDate) && {
      createdAt: {
        ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
        ...(filters.toDate   && { lte: new Date(filters.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.repairJob.findMany({
      where,
      skip,
      take,
      include: JOB_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.repairJob.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createJobInTx = (
  tx: Tx,
  data: {
    jobNo: string;
    outletId: string;
    customerId: string;
    technicianId?: string;
    createdById: string;
    deviceBrand: string;
    deviceModel: string;
    deviceColor?: string;
    serialNo?: string;
    condition?: string;
    problemDesc: string;
    internalNote?: string;
    laborCost: number;
    estimatedDone?: string;
  },
) =>
  tx.repairJob.create({
    data: {
      jobNo:         data.jobNo,
      outletId:      data.outletId,
      customerId:    data.customerId,
      technicianId:  data.technicianId,
      createdById:   data.createdById,
      deviceBrand:   data.deviceBrand,
      deviceModel:   data.deviceModel,
      deviceColor:   data.deviceColor,
      serialNo:      data.serialNo,
      condition:     data.condition,
      problemDesc:   data.problemDesc,
      internalNote:  data.internalNote,
      laborCost:     data.laborCost,
      totalCost:     data.laborCost,
      estimatedDone: data.estimatedDone ? new Date(data.estimatedDone) : undefined,
    },
    include: JOB_DETAIL_INCLUDE,
  });

export const updateJob = (id: string, data: UpdateRepairJobInput) =>
  prisma.repairJob.update({
    where: { id },
    data: {
      ...(data.technicianId  !== undefined && { technicianId:  data.technicianId }),
      ...(data.deviceBrand   !== undefined && { deviceBrand:   data.deviceBrand }),
      ...(data.deviceModel   !== undefined && { deviceModel:   data.deviceModel }),
      ...(data.deviceColor   !== undefined && { deviceColor:   data.deviceColor }),
      ...(data.serialNo      !== undefined && { serialNo:      data.serialNo }),
      ...(data.condition     !== undefined && { condition:     data.condition }),
      ...(data.problemDesc   !== undefined && { problemDesc:   data.problemDesc }),
      ...(data.diagnosis     !== undefined && { diagnosis:     data.diagnosis }),
      ...(data.internalNote  !== undefined && { internalNote:  data.internalNote }),
      ...(data.laborCost     !== undefined && { laborCost:     data.laborCost }),
      ...(data.estimatedDone !== undefined && {
        estimatedDone: new Date(data.estimatedDone),
      }),
    },
    include: JOB_DETAIL_INCLUDE,
  });

// Recompute totalCost = laborCost + sum(parts.subtotal) inside a tx
export const recalcTotalCostInTx = async (tx: Tx, repairId: string) => {
  const job = await tx.repairJob.findUnique({
    where: { id: repairId },
    select: { laborCost: true },
  });
  const agg = await tx.repairPart.aggregate({
    where: { repairId, used: true },
    _sum: { subtotal: true },
  });
  const partsCost = Number(agg._sum.subtotal ?? 0);
  const total = Number(job!.laborCost) + partsCost;

  return tx.repairJob.update({
    where: { id: repairId },
    data: { totalCost: total },
  });
};

export const updateStatusInTx = (
  tx: Tx,
  id: string,
  status: RepairStatus,
  extra?: { completedAt?: Date; deliveredAt?: Date },
) =>
  tx.repairJob.update({
    where: { id },
    data: {
      status,
      ...(extra?.completedAt  && { completedAt:  extra.completedAt }),
      ...(extra?.deliveredAt  && { deliveredAt:  extra.deliveredAt }),
    },
  });

export const createStatusLogInTx = (
  tx: Tx,
  repairId: string,
  changedById: string,
  fromStatus: RepairStatus | null,
  toStatus: RepairStatus,
  note?: string,
) =>
  tx.repairStatusLog.create({
    data: {
      repairId,
      changedById,
      fromStatus: fromStatus ?? undefined,
      toStatus,
      note,
    },
  });

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export const addPartInTx = (
  tx: Tx,
  repairId: string,
  itemId: string,
  quantity: number,
  unitCost: number,
) =>
  tx.repairPart.create({
    data: {
      repairId,
      itemId,
      quantity,
      unitCost,
      subtotal: unitCost * quantity,
    },
    include: { item: { select: { id: true, sku: true, name: true } } },
  });

export const findPartById = (id: string) =>
  prisma.repairPart.findUnique({ where: { id }, include: { repair: true } });

export const removePartInTx = (tx: Tx, id: string) =>
  tx.repairPart.delete({ where: { id } });

export const updatePartDiscountInTx = (tx: Tx, id: string, discount: number) =>
  tx.repairPart.update({
    where: { id },
    data: { discount },
  });

export const updatePartQuantityInTx = (tx: Tx, id: string, quantity: number) =>
  tx.repairPart.update({
    where: { id },
    data: { quantity },
  });

export const updatePartUsedInTx = (tx: Tx, id: string, used: boolean) =>
  tx.repairPart.update({
    where: { id },
    data: { used },
  });

// ---------------------------------------------------------------------------
// Payments (replaces advances)
// ---------------------------------------------------------------------------

export const createPaymentTransactionInTx = (
  tx: Tx,
  data: {
    txNo: string;
    repairJobId: string;
    totalAmount: number;
    totalChange: number;
    createdById: string;
    note?: string;
    legs: { method: 'CASH' | 'CARD'; amount: number; change: number; reference?: string }[];
  },
) =>
  tx.paymentTransaction.create({
    data: {
      txNo:         data.txNo,
      entityType:   PaymentEntityType.REPAIR,
      repairJobId:  data.repairJobId,
      totalAmount:  data.totalAmount,
      totalChange:  data.totalChange,
      note:         data.note,
      createdById:  data.createdById,
      legs: { create: data.legs },
    },
    include: { legs: true },
  });

export const sumRepairPaymentsInTx = async (tx: Tx, repairJobId: string): Promise<number> => {
  const agg = await tx.paymentTransaction.aggregate({
    where: { repairJobId },
    _sum: { totalAmount: true, totalChange: true },
  });
  return Math.max(0, Number(agg._sum.totalAmount ?? 0) - Number(agg._sum.totalChange ?? 0));
};
