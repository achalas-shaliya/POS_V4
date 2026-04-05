import { prisma } from '../../config/database';
import { AppError, notFound, conflict } from '../../shared/middleware/errorHandler';
import { ReturnStatus, ReturnReason, SaleStatus, MovementType, LocationType } from '../../generated/prisma/enums';
import { getPaginationArgs } from '../../shared/utils/pagination';
import * as repo from './returns.repository';
import * as invRepo from '../inventory/inventory.repository';
import type {
  CreateReturnInput,
  ApproveReturnInput,
  RejectReturnInput,
  ListReturnsInput,
} from './returns.schema';

// ---------------------------------------------------------------------------
// Return number generator — RET-YYYYMMDD-XXXXXX
// ---------------------------------------------------------------------------
const generateReturnNo = (): string => {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `RET-${date}-${suffix}`;
};

// ===========================================================================
// Create return request
// ===========================================================================

export const createReturn = async (input: CreateReturnInput, userId: string) => {
  // Validate sale exists and is COMPLETED (voided sales are already reversed)
  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    include: {
      items: true,
    },
  });
  if (!sale) throw notFound('Sale');
  if (sale.status !== SaleStatus.COMPLETED) {
    throw new AppError('Only COMPLETED sales can be returned', 400);
  }

  // Validate outlet
  const outlet = await invRepo.findOutletById(input.outletId);
  if (!outlet || !outlet.isActive) throw notFound('Outlet');

  // Validate all return line items against the original sale
  const saleItemMap = new Map(sale.items.map((si) => [si.id, si]));

  const returnLines: {
    saleItemId: string;
    itemId:     string;
    quantity:   number;
    unitPrice:  number;
    subtotal:   number;
  }[] = [];

  for (const line of input.items) {
    const saleItem = saleItemMap.get(line.saleItemId);
    if (!saleItem) {
      throw new AppError(`Sale item ${line.saleItemId} does not belong to this sale`, 400);
    }
    if (line.quantity > saleItem.quantity) {
      throw new AppError(
        `Return quantity (${line.quantity}) exceeds sold quantity (${saleItem.quantity}) for sale item ${line.saleItemId}`,
        400,
      );
    }
    const unitPrice = Number(saleItem.unitPrice) - Number(saleItem.discount ?? 0);
    returnLines.push({
      saleItemId: line.saleItemId,
      itemId:     saleItem.itemId,
      quantity:   line.quantity,
      unitPrice,
      subtotal:   parseFloat((unitPrice * line.quantity).toFixed(2)),
    });
  }

  // Compute total refund
  const refundAmount = parseFloat(
    returnLines.reduce((s, l) => s + l.subtotal, 0).toFixed(2),
  );

  const returnNo = generateReturnNo();

  return prisma.$transaction(async (tx) =>
    repo.createReturnInTx(tx, {
      returnNo,
      saleId:   input.saleId,
      outletId: input.outletId,
      reason:   input.reason as ReturnReason,
      note:     input.note,
      createdById: userId,
      items: returnLines,
      refundAmount,
    }),
  );
};

// ===========================================================================
// Approve return — restores stock, records RETURN movements
// ===========================================================================

export const approveReturn = async (
  id: string,
  _input: ApproveReturnInput,
  userId: string,
) => {
  const saleReturn = await repo.findReturnById(id);
  if (!saleReturn) throw notFound('Return');

  if (saleReturn.status !== ReturnStatus.PENDING) {
    throw new AppError(
      `Return is already ${saleReturn.status.toLowerCase()}. Only PENDING returns can be approved.`,
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Restore outlet stock and create RETURN movements for each line
    for (const line of saleReturn.items) {
      await invRepo.upsertOutletStock(tx, saleReturn.outletId, line.itemId, line.quantity);

      await invRepo.createMovement(tx, {
        movementType: MovementType.RETURN,
        quantity:     line.quantity,
        referenceId:  id,
        itemId:       line.itemId,
        toType:       LocationType.OUTLET,
        toId:         saleReturn.outletId,
        note:         `Return ${saleReturn.returnNo} — ${saleReturn.reason}`,
        createdBy:    userId,
      });
    }

    await repo.approveReturnInTx(tx, id, userId);
  });

  return repo.findReturnById(id);
};

// ===========================================================================
// Reject return — no stock change; just mark as REJECTED
// ===========================================================================

export const rejectReturn = async (
  id: string,
  input: RejectReturnInput,
  userId: string,
) => {
  const saleReturn = await repo.findReturnById(id);
  if (!saleReturn) throw notFound('Return');

  if (saleReturn.status !== ReturnStatus.PENDING) {
    throw new AppError(
      `Return is already ${saleReturn.status.toLowerCase()}. Only PENDING returns can be rejected.`,
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    await repo.rejectReturnInTx(tx, id, userId, input.note);
  });

  return repo.findReturnById(id);
};

// ===========================================================================
// Reads
// ===========================================================================

export const getReturnById = async (id: string) => {
  const saleReturn = await repo.findReturnById(id);
  if (!saleReturn) throw notFound('Return');
  return saleReturn;
};

export const getReturnByNo = async (returnNo: string) => {
  const saleReturn = await repo.findReturnByNo(returnNo);
  if (!saleReturn) throw notFound('Return');
  return saleReturn;
};

export const listReturns = async (input: ListReturnsInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [data, total] = await repo.listReturns(skip, take, {
    status:   input.status,
    outletId: input.outletId,
    saleId:   input.saleId,
    fromDate: input.fromDate,
    toDate:   input.toDate,
  });
  return { data, total, page: input.page, limit: input.limit };
};
