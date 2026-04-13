import { prisma } from '../../config/database';
import { AppError, notFound } from '../../shared/middleware/errorHandler';
import { SaleStatus, RepairStatus } from '../../generated/prisma/enums';
import { getPaginationArgs } from '../../shared/utils/pagination';
import * as repo from './payment.repository';
import { notifyRepairJobChanged } from '../../shared/realtime/repairRealtime';
import type {
  RecordSalePaymentInput,
  RecordRepairPaymentInput,
  SettleRepairInput,
  ListPaymentsInput,
  PaymentLegInput,
} from './payment.schema';

// ---------------------------------------------------------------------------
// Payment transaction number — PAY-YYYYMMDD-XXXXXX
// ---------------------------------------------------------------------------
const generateTxNo = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `PAY-${date}-${suffix}`;
};

// ---------------------------------------------------------------------------
// Validate a set of payment legs:
//  • total paid must cover the required amount
//  • change can only be given on a CASH leg
// ---------------------------------------------------------------------------
function validateLegs(legs: PaymentLegInput[], required: number) {
  const totalPaid = legs.reduce((s, l) => s + l.amount, 0);

  if (totalPaid < required) {
    throw new AppError(
      `Underpayment: required ${required.toFixed(2)}, received ${totalPaid.toFixed(2)}`,
      400,
    );
  }

  const change = parseFloat((totalPaid - required).toFixed(2));
  const hasCash = legs.some((l) => l.method === 'CASH');

  if (change > 0 && !hasCash) {
    throw new AppError(
      'Change can only be given when at least one leg is CASH',
      400,
    );
  }

  return { totalPaid, change };
}

/**
 * Assign change to the first CASH leg (standard POS behaviour).
 * Returns legs enriched with a `change` field.
 */
function buildLegsWithChange(
  legs: PaymentLegInput[],
  change: number,
): { method: 'CASH' | 'CARD'; amount: number; change: number; reference?: string }[] {
  let remaining = change;
  return legs.map((l) => {
    let legChange = 0;
    if (l.method === 'CASH' && remaining > 0) {
      legChange = remaining;
      remaining = 0;
    }
    return { method: l.method, amount: l.amount, change: legChange, reference: l.reference };
  });
}

// ===========================================================================
// Sale payments
// ===========================================================================

/**
 * Record an additional payment against an existing (COMPLETED) sale.
 * Useful for deferred / split settlements recorded after the original checkout.
 */
export const recordSalePayment = async (
  input: RecordSalePaymentInput,
  userId: string,
) => {
  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    include: { payments: { select: { totalAmount: true } } },
  });
  if (!sale) throw notFound('Sale');
  if (sale.status === SaleStatus.VOIDED) {
    throw new AppError('Cannot add payment to a voided sale', 400);
  }

  // Determine outstanding balance
  const alreadyPaid = sale.payments.reduce((s, p) => s + Number(p.totalAmount), 0);
  const outstanding = parseFloat((Number(sale.total) - alreadyPaid).toFixed(2));

  if (outstanding <= 0) {
    throw new AppError('Sale is already fully paid', 400);
  }

  const { totalPaid, change } = validateLegs(input.payments, outstanding);
  const enrichedLegs = buildLegsWithChange(input.payments, change);
  const txNo = generateTxNo();

  const tx = await prisma.$transaction(async (dbTx) =>
    repo.createTransactionInTx(dbTx, {
      txNo,
      entityType:  'SALE',
      saleId:      input.saleId,
      totalAmount: totalPaid,
      totalChange: change,
      note:        input.note,
      createdById: userId,
      legs:        enrichedLegs,
    }),
  );

  return tx;
};

/**
 * Get payment summary for a sale.
 */
export const getSalePaymentSummary = async (saleId: string) => {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale) throw notFound('Sale');

  const transactions = await repo.listTransactionsBySale(saleId);
  const totalPaid    = transactions.reduce((s, t) => s + Number(t.totalAmount), 0);
  const saleTotal    = Number(sale.total);

  return {
    saleId,
    saleTotal,
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    balance:   parseFloat(Math.max(0, saleTotal - totalPaid).toFixed(2)),
    transactions,
  };
};

// ===========================================================================
// Repair payments
// ===========================================================================

/**
 * Record one or more payment legs against a repair job (advance or partial).
 * Does NOT change the repair status — use settleRepair for final delivery.
 */
export const recordRepairPayment = async (
  repairJobId: string,
  input: RecordRepairPaymentInput,
  userId: string,
) => {
  const job = await prisma.repairJob.findUnique({ where: { id: repairJobId } });
  if (!job) throw notFound('Repair job');

  if (
    job.status === RepairStatus.DELIVERED ||
    job.status === RepairStatus.CANCELLED
  ) {
    throw new AppError('Cannot add payment to a finished repair', 400);
  }

  // Validate legs — amounts are free for partial/advance; just ensure > 0
  const totalPaid = input.payments.reduce((s, l) => s + l.amount, 0);
  if (totalPaid <= 0) throw new AppError('Payment amount must be positive', 400);

  const change     = 0;  // advances have no change
  const enrichedLegs = buildLegsWithChange(input.payments, change);
  const txNo = generateTxNo();

  const transaction = await prisma.$transaction(async (dbTx) => {
    const transaction = await repo.createTransactionInTx(dbTx, {
      txNo,
      entityType:  'REPAIR',
      repairJobId,
      totalAmount: totalPaid,
      totalChange: change,
      note:        input.note,
      createdById: userId,
      legs:        enrichedLegs,
    });

    // Keep denormalized advancePaid in sync
    const newTotal = await repo.sumRepairPaymentsInTx(dbTx, repairJobId);
    await dbTx.repairJob.update({
      where: { id: repairJobId },
      data:  { advancePaid: newTotal },
    });

    return transaction;
  });

  notifyRepairJobChanged({
    repairId: repairJobId,
    jobNo: job.jobNo,
    outletId: job.outletId,
    action: 'PAYMENT_ADDED',
  });

  return transaction;
};

/**
 * Settle a repair job: collect the remaining balance, record the payment,
 * and transition the job to DELIVERED — all in one atomic transaction.
 */
export const settleRepair = async (
  repairJobId: string,
  input: SettleRepairInput,
  userId: string,
) => {
  const job = await prisma.repairJob.findUnique({ where: { id: repairJobId } });
  if (!job) throw notFound('Repair job');

  if (job.status !== RepairStatus.DONE) {
    throw new AppError(
      `Only DONE jobs can be settled. Current status: ${job.status}`,
      400,
    );
  }

  const alreadyPaid  = Number(job.advancePaid);
  const totalCost    = Number(job.totalCost);
  const balance      = parseFloat(Math.max(0, totalCost - alreadyPaid).toFixed(2));

  const { totalPaid, change } = validateLegs(input.payments, balance);
  const enrichedLegs = buildLegsWithChange(input.payments, change);
  const txNo = generateTxNo();
  const now  = new Date();

  const settled = await prisma.$transaction(async (dbTx) => {
    // Record settlement payment
    const transaction = await repo.createTransactionInTx(dbTx, {
      txNo,
      entityType:  'REPAIR',
      repairJobId,
      totalAmount: totalPaid,
      totalChange: change,
      note:        input.note ?? 'Settlement on delivery',
      createdById: userId,
      legs:        enrichedLegs,
    });

    // Update advancePaid + status + deliveredAt atomically
    const newAdvancePaid = alreadyPaid + totalPaid - change;
    await dbTx.repairJob.update({
      where: { id: repairJobId },
      data: {
        advancePaid: newAdvancePaid,
        status:      RepairStatus.DELIVERED,
        deliveredAt: now,
      },
    });

    // Write status log
    await dbTx.repairStatusLog.create({
      data: {
        repairId:    repairJobId,
        changedById: userId,
        fromStatus:  RepairStatus.DONE,
        toStatus:    RepairStatus.DELIVERED,
        note:        input.note ?? 'Settled and delivered',
      },
    });

    return { transaction, status: RepairStatus.DELIVERED };
  });

  notifyRepairJobChanged({
    repairId: repairJobId,
    jobNo: job.jobNo,
    outletId: job.outletId,
    action: 'SETTLED',
  });

  return settled;
};

/**
 * Get payment summary for a repair job.
 */
export const getRepairPaymentSummary = async (repairJobId: string) => {
  const job = await prisma.repairJob.findUnique({ where: { id: repairJobId } });
  if (!job) throw notFound('Repair job');

  const transactions = await repo.listTransactionsByRepair(repairJobId);
  const totalPaid    = transactions.reduce((s, t) => s + Number(t.totalAmount), 0);
  const totalCost    = Number(job.totalCost);

  return {
    repairJobId,
    jobNo:      job.jobNo,
    status:     job.status,
    totalCost,
    totalPaid:  parseFloat(totalPaid.toFixed(2)),
    balance:    parseFloat(Math.max(0, totalCost - totalPaid).toFixed(2)),
    transactions,
  };
};

// ===========================================================================
// Generic reads
// ===========================================================================

export const getTransactionById = async (id: string) => {
  const tx = await repo.findTransactionById(id);
  if (!tx) throw notFound('Payment transaction');
  return tx;
};

export const listTransactions = async (input: ListPaymentsInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [data, total] = await repo.listTransactions(skip, take, {
    entityType: input.entityType,
    fromDate:   input.fromDate,
    toDate:     input.toDate,
  });
  return { data, total, page: input.page, limit: input.limit };
};
