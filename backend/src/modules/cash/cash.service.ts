import { prisma } from '../../config/database';
import { AppError, notFound, conflict } from '../../shared/middleware/errorHandler';
import { CashMovementType, RegisterStatus } from '../../generated/prisma/enums';
import { getPaginationArgs } from '../../shared/utils/pagination';
import * as repo from './cash.repository';
import * as invRepo from '../inventory/inventory.repository';
import type {
  OpenRegisterInput,
  CashInOutInput,
  CloseRegisterInput,
  ListRegistersInput,
  ListMovementsInput,
} from './cash.schema';

// ===========================================================================
// Open register
// ===========================================================================

/**
 * Opens a new cash register for the requesting user.
 * Rules:
 *   - User must not already have an OPEN register.
 *   - Outlet must exist and be active.
 *   - Records an OPENING_FLOAT movement for the initial balance.
 */
export const openRegister = async (input: OpenRegisterInput, userId: string) => {
  // 1. Validate outlet
  const outlet = await invRepo.findOutletById(input.outletId);
  if (!outlet || !outlet.isActive) throw notFound('Outlet');

  // 2. Enforce: one open register per user
  const existing = await repo.findOpenRegisterByUser(userId);
  if (existing) {
    throw conflict(
      `You already have an open register (${existing.id}). Close it before opening a new one.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Create the register
    const register = await repo.createRegisterInTx(tx, {
      outletId:       input.outletId,
      openedById:     userId,
      openingBalance: input.openingBalance,
    });

    // Record the opening float as the first movement
    await repo.createMovementInTx(tx, {
      registerId:  register.id,
      createdById: userId,
      type:        CashMovementType.OPENING_FLOAT,
      amount:      input.openingBalance,
      note:        input.note ?? 'Opening float',
    });

    return register;
  });
};

// ===========================================================================
// Get current open register for the authenticated user
// ===========================================================================

export const getMyOpenRegister = async (userId: string) => {
  const register = await repo.findOpenRegisterByUser(userId);
  if (!register) throw notFound('Open register');
  return register;
};

// ===========================================================================
// Cash In — manual addition (e.g. float top-up, petty cash received)
// ===========================================================================

export const cashIn = async (
  registerId: string,
  input: CashInOutInput,
  userId: string,
) => {
  const register = await repo.findRegisterById(registerId);
  if (!register) throw notFound('Cash register');

  if (register.status === RegisterStatus.CLOSED) {
    throw new AppError('Register is already closed', 400);
  }

  // Only the register owner can add to it (supervisors use a separate route)
  if (register.openedById !== userId) {
    throw new AppError('You can only manage your own register', 403);
  }

  return prisma.$transaction(async (tx) => {
    const movement = await repo.createMovementInTx(tx, {
      registerId,
      createdById: userId,
      type:        CashMovementType.CASH_IN,
      amount:      input.amount,
      note:        input.note,
    });
    return movement;
  });
};

// ===========================================================================
// Cash Out — manual removal (e.g. bank drop, paying an expense)
// ===========================================================================

export const cashOut = async (
  registerId: string,
  input: CashInOutInput,
  userId: string,
) => {
  const register = await repo.findRegisterById(registerId);
  if (!register) throw notFound('Cash register');

  if (register.status === RegisterStatus.CLOSED) {
    throw new AppError('Register is already closed', 400);
  }

  if (register.openedById !== userId) {
    throw new AppError('You can only manage your own register', 403);
  }

  // Guard: cannot take out more than what is currently in the drawer
  const currentBalance = await repo.computeExpectedCash(registerId);
  if (input.amount > currentBalance) {
    throw new AppError(
      `Insufficient cash in drawer. Current balance: ${currentBalance.toFixed(2)}`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const movement = await repo.createMovementInTx(tx, {
      registerId,
      createdById: userId,
      type:        CashMovementType.CASH_OUT,
      amount:      input.amount,
      note:        input.note,
    });
    return movement;
  });
};

// ===========================================================================
// Record a cash transaction from a sale or repair payment
// Called internally by the payment module when a CASH leg is detected.
// ===========================================================================

/**
 * Attach a SALE_CASH or REPAIR_CASH movement to the cashier's open register.
 * The `netAmount` is the cash received minus change given (net inflow).
 * Safe to call inside an existing Prisma transaction.
 */
export const recordCashFromPayment = async (opts: {
  userId:        string;
  entityType:    'SALE' | 'REPAIR';
  netAmount:     number;   // amount - change
  referenceId:   string;   // PaymentTransaction.id
  note?:         string;
}) => {
  if (opts.netAmount <= 0) return;  // no net cash inflow — skip silently

  const register = await repo.findOpenRegisterByUser(opts.userId);
  if (!register) return;  // no open register — silently skip (not all users track a register)

  const movementType =
    opts.entityType === 'SALE'
      ? CashMovementType.SALE_CASH
      : CashMovementType.REPAIR_CASH;

  await prisma.$transaction(async (tx) => {
    await repo.createMovementInTx(tx, {
      registerId:  register.id,
      createdById: opts.userId,
      type:        movementType,
      amount:      opts.netAmount,
      note:        opts.note,
      referenceId: opts.referenceId,
    });
  });
};

// ===========================================================================
// Close register
// ===========================================================================

/**
 * Closes the register:
 *  1. Computes expected cash (opening + all cash-in movements − cash-out).
 *  2. Records the cashier-counted actual cash.
 *  3. Stores the difference (over/short).
 *  4. Marks the register CLOSED.
 */
export const closeRegister = async (
  registerId: string,
  input: CloseRegisterInput,
  userId: string,
) => {
  const register = await repo.findRegisterById(registerId);
  if (!register) throw notFound('Cash register');

  if (register.status === RegisterStatus.CLOSED) {
    throw new AppError('Register is already closed', 400);
  }

  if (register.openedById !== userId) {
    throw new AppError('You can only close your own register', 403);
  }

  return prisma.$transaction(async (tx) => {
    const expectedCash = await repo.computeExpectedCashInTx(tx, registerId);
    const difference   = parseFloat((input.actualCash - expectedCash).toFixed(2));

    return repo.closeRegisterInTx(tx, registerId, {
      closedById:   userId,
      expectedCash,
      actualCash:   input.actualCash,
      difference,
      closingNote:  input.closingNote,
    });
  });
};

// ===========================================================================
// Reads
// ===========================================================================

export const getRegisterById = async (id: string) => {
  const register = await repo.findRegisterById(id);
  if (!register) throw notFound('Cash register');
  return register;
};

export const listRegisters = async (input: ListRegistersInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [data, total] = await repo.listRegisters(skip, take, {
    outletId: input.outletId,
    userId:   input.userId,
    status:   input.status,
    fromDate: input.fromDate,
    toDate:   input.toDate,
  });
  return { data, total, page: input.page, limit: input.limit };
};

export const listMovements = async (
  registerId: string,
  input: ListMovementsInput,
) => {
  const register = await repo.findRegisterById(registerId);
  if (!register) throw notFound('Cash register');

  const { skip, take } = getPaginationArgs(input);
  const movementType = input.type
    ? (input.type as CashMovementType)
    : undefined;

  const [data, total] = await repo.listMovements(registerId, skip, take, movementType);
  return { data, total, page: input.page, limit: input.limit };
};

/** Current running cash balance for a register (read-only, no side effects) */
export const getRegisterBalance = async (registerId: string) => {
  const register = await repo.findRegisterById(registerId);
  if (!register) throw notFound('Cash register');

  const expectedCash = await repo.computeExpectedCash(registerId);
  return {
    registerId,
    status:         register.status,
    openingBalance: Number(register.openingBalance),
    expectedCash,
  };
};
