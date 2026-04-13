import { prisma } from '../../config/database';
import { AppError, notFound, conflict } from '../../shared/middleware/errorHandler';
import { RepairStatus, MovementType, LocationType } from '../../generated/prisma/enums';
import { getPaginationArgs } from '../../shared/utils/pagination';
import * as repo from './repair.repository';
import * as invRepo from '../inventory/inventory.repository';
import { recordCashFromPayment } from '../cash/cash.service';
import { notifyRepairJobCreated, notifyRepairJobChanged } from '../../shared/realtime/repairRealtime';
import { ALLOWED_TRANSITIONS } from './repair.schema';
import type {
  CreateRepairJobInput,
  UpdateRepairJobInput,
  UpdateRepairStatusInput,
  AddPartInput,
  AddAdvanceInput,
  ListRepairJobsInput,
} from './repair.schema';

// ---------------------------------------------------------------------------
// Job-number generator — e.g. REP-20260329-4XT9M2
// ---------------------------------------------------------------------------
const generateJobNo = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `REP-${date}-${suffix}`;
};

// Payment transaction number — e.g. PAY-20260329-XXXXXX
const generatePaymentTxNo = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = (Date.now() + 1).toString(36).toUpperCase().slice(-6);
  return `PAY-${date}-${suffix}`;
};

// ---------------------------------------------------------------------------
// Create repair job (+ optional advance payment)
// ---------------------------------------------------------------------------
export const createRepairJob = async (
  data: CreateRepairJobInput,
  userId: string,
) => {
  // Validate outlet and customer exist
  const [outlet, customer] = await Promise.all([
    invRepo.findOutletById(data.outletId),
    prisma.customer.findUnique({ where: { id: data.customerId } }),
  ]);
  if (!outlet || !outlet.isActive) throw notFound('Outlet');
  if (!customer) throw notFound('Customer');

  if (data.technicianId) {
    const tech = await prisma.user.findUnique({ where: { id: data.technicianId } });
    if (!tech || !tech.isActive) throw notFound('Technician');
  }

  const jobNo = generateJobNo();

  const job = await prisma.$transaction(async (tx) => {
    const newJob = await repo.createJobInTx(tx, { ...data, jobNo, createdById: userId });

    // Write initial status log
    await repo.createStatusLogInTx(
      tx,
      newJob.id,
      userId,
      null,
      RepairStatus.PENDING,
      'Job created',
    );

    // Record advance payment if provided
    if (data.advance) {
      const txNo = generatePaymentTxNo();
      await repo.createPaymentTransactionInTx(tx, {
        txNo,
        repairJobId: newJob.id,
        totalAmount: data.advance.amount,
        totalChange: 0,
        createdById: userId,
        note: data.advance.note,
        legs: [{
          method:    data.advance.method,
          amount:    data.advance.amount,
          change:    0,
          reference: data.advance.reference,
        }],
      });
      await tx.repairJob.update({
        where: { id: newJob.id },
        data: { advancePaid: data.advance.amount },
      });
    }

    return newJob;
  });

  notifyRepairJobCreated({
    repairId: job.id,
    jobNo: job.jobNo,
    outletId: job.outletId,
  });

  return job;
};

// ---------------------------------------------------------------------------
// Update editable fields (not status)
// ---------------------------------------------------------------------------
export const updateRepairJob = async (id: string, data: UpdateRepairJobInput) => {
  const job = await repo.findJobById(id);
  if (!job) throw notFound('Repair job');

  if (job.status === RepairStatus.DELIVERED || job.status === RepairStatus.CANCELLED) {
    throw new AppError('Cannot edit a finished repair job', 400);
  }

  if (data.technicianId) {
    const tech = await prisma.user.findUnique({ where: { id: data.technicianId } });
    if (!tech || !tech.isActive) throw notFound('Technician');
  }

  const updated = await repo.updateJob(id, data);

  // If laborCost changed, recompute totalCost
  if (data.laborCost !== undefined) {
    await prisma.$transaction(async (tx) => {
      await repo.recalcTotalCostInTx(tx, id);
    });
  }

  notifyRepairJobChanged({
    repairId: job.id,
    jobNo: job.jobNo,
    outletId: job.outletId,
    action: 'UPDATED',
  });

  return updated;
};

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------
export const updateStatus = async (
  id: string,
  input: UpdateRepairStatusInput,
  userId: string,
) => {
  const job = await repo.findJobById(id);
  if (!job) throw notFound('Repair job');

  const allowed = ALLOWED_TRANSITIONS[job.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw new AppError(
      `Invalid transition: ${job.status} → ${input.status}. Allowed: ${allowed.join(', ') || 'none'}`,
      400,
    );
  }

  const newStatus = input.status as RepairStatus;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await repo.updateStatusInTx(tx, id, newStatus, {
      completedAt: newStatus === RepairStatus.DONE      ? now : undefined,
      deliveredAt: newStatus === RepairStatus.DELIVERED ? now : undefined,
    });

    await repo.createStatusLogInTx(
      tx,
      id,
      userId,
      job.status as RepairStatus,
      newStatus,
      input.note,
    );
  });

  notifyRepairJobChanged({
    repairId: job.id,
    jobNo: job.jobNo,
    outletId: job.outletId,
    action: 'STATUS_CHANGED',
  });

  return repo.findJobById(id);
};

// ---------------------------------------------------------------------------
// Add a part — deducts stock, locks cost price, recomputes job total
// ---------------------------------------------------------------------------
export const addPart = async (
  repairId: string,
  input: AddPartInput,
  userId: string,
) => {
  const job = await repo.findJobById(repairId);
  if (!job) throw notFound('Repair job');

  if (
    job.status === RepairStatus.DONE ||
    job.status === RepairStatus.DELIVERED ||
    job.status === RepairStatus.CANCELLED
  ) {
    throw new AppError('Cannot add parts to a finished or cancelled repair', 400);
  }

  const item = await invRepo.findItemById(input.itemId);
  if (!item) throw notFound('Item');
  if (!item.isActive) throw new AppError('Item is inactive', 400);

  const unitCost = input.unitCost ?? Number(item.costPrice);

  const part = await prisma.$transaction(async (tx) => {
    // Validate + deduct stock
    const stock = await invRepo.getOutletStockInTx(tx, job.outletId, input.itemId);
    if (!stock || stock.quantity < input.quantity) {
      throw new AppError(
        `Insufficient outlet stock for "${item.name}" (available: ${stock?.quantity ?? 0})`,
        400,
      );
    }
    await invRepo.upsertOutletStock(tx, job.outletId, input.itemId, -input.quantity);

    // Record stock movement linked to this repair
    await invRepo.createMovement(tx, {
      movementType: MovementType.SALE,    // treat parts usage as a SALE deduction
      quantity:     input.quantity,
      referenceId:  repairId,
      itemId:       input.itemId,
      fromType:     LocationType.OUTLET,
      fromId:       job.outletId,
      createdBy:    userId,
      note:         `Repair job ${job.jobNo}`,
    });

    // Persist repair part record
    const part = await repo.addPartInTx(tx, repairId, input.itemId, input.quantity, unitCost);

    // Recompute job totalCost
    await repo.recalcTotalCostInTx(tx, repairId);

    return part;
  });

  notifyRepairJobChanged({
    repairId,
    jobNo: job.jobNo,
    outletId: job.outletId,
    action: 'PART_ADDED',
  });

  return part;
};

// ---------------------------------------------------------------------------
// Remove a part — restores stock, recomputes job total
// ---------------------------------------------------------------------------
export const removePart = async (partId: string, userId: string) => {
  const part = await repo.findPartById(partId);
  if (!part) throw notFound('Repair part');

  const job = part.repair;
  if (
    job.status === RepairStatus.DONE ||
    job.status === RepairStatus.DELIVERED ||
    job.status === RepairStatus.CANCELLED
  ) {
    throw new AppError('Cannot remove parts from a finished or cancelled repair', 400);
  }

  await prisma.$transaction(async (tx) => {
    // Restore outlet stock
    await invRepo.upsertOutletStock(tx, job.outletId, part.itemId, part.quantity);

    // Record a RETURN movement
    await invRepo.createMovement(tx, {
      movementType: MovementType.RETURN,
      quantity:     part.quantity,
      referenceId:  job.id,
      itemId:       part.itemId,
      toType:       LocationType.OUTLET,
      toId:         job.outletId,
      createdBy:    userId,
      note:         `Part removed from repair ${job.jobNo}`,
    });

    await repo.removePartInTx(tx, partId);
    await repo.recalcTotalCostInTx(tx, job.id);
  });

  notifyRepairJobChanged({
    repairId: job.id,
    jobNo: job.jobNo,
    outletId: job.outletId,
    action: 'PART_REMOVED',
  });
};

// ---------------------------------------------------------------------------
// Add a payment against a repair job (advance or any partial payment)
// ---------------------------------------------------------------------------
export const addAdvance = async (
  repairId: string,
  input: AddAdvanceInput,
  userId: string,
) => {
  const job = await repo.findJobById(repairId);
  if (!job) throw notFound('Repair job');

  if (
    job.status === RepairStatus.DELIVERED ||
    job.status === RepairStatus.CANCELLED
  ) {
    throw new AppError('Cannot add payment to a finished repair', 400);
  }

  const txNo = generatePaymentTxNo();

  // Calculate how much is actually owed and how much change to give back
  const balanceDue = Math.max(0, Number(job.totalCost) - Number(job.advancePaid ?? 0));
  const change      = Math.max(0, input.amount - balanceDue);
  const netReceived = parseFloat((input.amount - change).toFixed(2));

  await prisma.$transaction(async (tx) => {
    await repo.createPaymentTransactionInTx(tx, {
      txNo,
      repairJobId: repairId,
      totalAmount: input.amount,
      totalChange: change,
      createdById: userId,
      note: input.note,
      legs: [{
        method:    input.method,
        amount:    input.amount,
        change,
        reference: input.reference,
      }],
    });

    // Keep the denormalised advancePaid in sync (net of change)
    const total = await repo.sumRepairPaymentsInTx(tx, repairId);
    await tx.repairJob.update({
      where: { id: repairId },
      data: { advancePaid: total },
    });
  });

  // Post-transaction: record cash inflow in the cashier's open register (if any).
  // Only CASH legs contribute to the register; CARD is handled externally.
  if (input.method === 'CASH' && netReceived > 0) {
    try {
      await recordCashFromPayment({
        userId,
        entityType: 'REPAIR',
        netAmount: netReceived,
        referenceId: repairId,
        note: input.note ?? 'Repair payment',
      });
    } catch {
      // No open register — silently skip
    }
  }

  notifyRepairJobChanged({
    repairId,
    jobNo: job.jobNo,
    outletId: job.outletId,
    action: 'PAYMENT_ADDED',
  });

  return repo.findJobById(repairId);
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getJobById = async (id: string) => {
  const job = await repo.findJobById(id);
  if (!job) throw notFound('Repair job');
  return job;
};

export const getJobByNo = async (jobNo: string) => {
  const job = await repo.findJobByNo(jobNo);
  if (!job) throw notFound('Repair job');
  return job;
};

export const listJobs = async (input: ListRepairJobsInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [data, total] = await repo.listJobs(skip, take, {
    outletId:     input.outletId,
    customerId:   input.customerId,
    technicianId: input.technicianId,
    status:       input.status,
    fromDate:     input.fromDate,
    toDate:       input.toDate,
  });
  return { data, total, page: input.page, limit: input.limit };
};

// Balance due to collect on delivery
export const getBalance = async (id: string) => {
  const job = await repo.findJobById(id);
  if (!job) throw notFound('Repair job');

  const balance = Math.max(0, Number(job.totalCost) - Number(job.advancePaid));
  return {
    totalCost:   Number(job.totalCost),
    advancePaid: Number(job.advancePaid),
    balance,
  };
};
