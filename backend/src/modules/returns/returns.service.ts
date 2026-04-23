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
  CreateSupplierReturnInput,
  ListSupplierReturnsInput,
  ListReturnStockInput,
} from './returns.schema';

const CUSTOMER_RETURN_NOTE_PREFIX = 'Return RET-';

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

const buildSupplierReturnNote = (supplierName?: string, note?: string) => {
  const supplier = supplierName?.trim() ? `supplier=${supplierName.trim()}` : 'supplier=unknown';
  const extra = note?.trim() ? ` | note=${note.trim()}` : '';
  return `${repo.SUPPLIER_RETURN_NOTE_PREFIX}:${supplier}${extra}`;
};

const parseSupplierReturnNote = (note?: string | null) => {
  if (!note || !note.startsWith(repo.SUPPLIER_RETURN_NOTE_PREFIX)) {
    return { supplierName: null as string | null, note: null as string | null };
  }

  const body = note.slice(repo.SUPPLIER_RETURN_NOTE_PREFIX.length + 1);
  const parts = body.split('|').map((p) => p.trim());
  const supplierPart = parts.find((p) => p.startsWith('supplier='));
  const notePart = parts.find((p) => p.startsWith('note='));

  return {
    supplierName: supplierPart ? supplierPart.replace(/^supplier=/, '') : null,
    note: notePart ? notePart.replace(/^note=/, '') : null,
  };
};

export const createSupplierReturn = async (input: CreateSupplierReturnInput, userId: string) => {
  const [outlet, item] = await Promise.all([
    invRepo.findOutletById(input.outletId),
    invRepo.findItemById(input.itemId),
  ]);

  if (!outlet || !outlet.isActive) throw notFound('Outlet');
  if (!item || !item.isActive) throw notFound('Item');

  const movement = await prisma.$transaction(async (tx) => {
    const stock = await invRepo.getOutletStockInTx(tx, input.outletId, input.itemId);
    if (!stock || stock.quantity < input.quantity) {
      throw new AppError(
        `Insufficient stock for "${item.name}" at ${outlet.name} (available: ${stock?.quantity ?? 0})`,
        400,
      );
    }

    await invRepo.upsertOutletStock(tx, input.outletId, input.itemId, -input.quantity);

    return invRepo.createMovement(tx, {
      movementType: MovementType.RETURN,
      quantity: input.quantity,
      itemId: input.itemId,
      fromType: LocationType.OUTLET,
      fromId: input.outletId,
      note: buildSupplierReturnNote(input.supplierName, input.note),
      createdBy: userId,
    });
  });

  return {
    id: movement.id,
    item: { id: item.id, sku: item.sku, name: item.name },
    outlet: { id: outlet.id, name: outlet.name },
    quantity: movement.quantity,
    supplierName: input.supplierName?.trim() || null,
    note: input.note?.trim() || null,
    createdAt: movement.createdAt,
  };
};

export const listSupplierReturns = async (input: ListSupplierReturnsInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [rows, total] = await repo.listSupplierReturns(skip, take, {
    outletId: input.outletId,
    itemId: input.itemId,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const outletIds = Array.from(new Set(rows.map((r) => r.fromId).filter(Boolean))) as string[];
  const outlets = outletIds.length
    ? await prisma.outlet.findMany({ where: { id: { in: outletIds } }, select: { id: true, name: true } })
    : [];
  const outletMap = new Map(outlets.map((o) => [o.id, o]));

  const data = rows.map((row) => {
    const parsed = parseSupplierReturnNote(row.note);
    return {
      id: row.id,
      createdAt: row.createdAt,
      quantity: row.quantity,
      outlet: row.fromId
        ? {
            id: row.fromId,
            name: outletMap.get(row.fromId)?.name ?? 'Unknown outlet',
          }
        : null,
      item: row.item,
      createdByUser: row.createdByUser,
      supplierName: parsed.supplierName,
      note: parsed.note,
    };
  });

  return { data, total, page: input.page, limit: input.limit };
};

export const listReturnStock = async (input: ListReturnStockInput) => {
  const movements = await prisma.stockMovement.findMany({
    where: {
      movementType: MovementType.RETURN,
      ...(input.itemId && { itemId: input.itemId }),
      OR: [
        {
          toType: LocationType.OUTLET,
          ...(input.outletId && { toId: input.outletId }),
          note: { startsWith: CUSTOMER_RETURN_NOTE_PREFIX },
        },
        {
          fromType: LocationType.OUTLET,
          toType: null,
          ...(input.outletId && { fromId: input.outletId }),
          note: { startsWith: repo.SUPPLIER_RETURN_NOTE_PREFIX },
        },
      ],
    },
    include: {
      item: { select: { id: true, sku: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const outletIds = Array.from(
    new Set(
      movements
        .flatMap((m) => [m.toType === LocationType.OUTLET ? m.toId : null, m.fromType === LocationType.OUTLET ? m.fromId : null])
        .filter(Boolean),
    ),
  ) as string[];

  const outlets = outletIds.length
    ? await prisma.outlet.findMany({ where: { id: { in: outletIds } }, select: { id: true, name: true } })
    : [];
  const outletMap = new Map(outlets.map((o) => [o.id, o.name]));

  const ledger = new Map<string, {
    outletId: string;
    outletName: string;
    item: { id: string; sku: string; name: string };
    returnedInQty: number;
    returnedToSupplierQty: number;
    lastIncomingAt: string | null;
    lastOutgoingAt: string | null;
  }>();

  for (const movement of movements) {
    let outletId: string | null = null;
    let direction: 'IN' | 'OUT' | null = null;

    if (
      movement.toType === LocationType.OUTLET &&
      movement.toId &&
      movement.note?.startsWith(CUSTOMER_RETURN_NOTE_PREFIX)
    ) {
      outletId = movement.toId;
      direction = 'IN';
    }

    if (
      movement.fromType === LocationType.OUTLET &&
      movement.fromId &&
      movement.toType === null &&
      movement.note?.startsWith(repo.SUPPLIER_RETURN_NOTE_PREFIX)
    ) {
      outletId = movement.fromId;
      direction = 'OUT';
    }

    if (!outletId || !direction) continue;

    const key = `${outletId}:${movement.itemId}`;
    const current =
      ledger.get(key) ??
      {
        outletId,
        outletName: outletMap.get(outletId) ?? 'Unknown outlet',
        item: movement.item,
        returnedInQty: 0,
        returnedToSupplierQty: 0,
        lastIncomingAt: null,
        lastOutgoingAt: null,
      };

    if (direction === 'IN') {
      current.returnedInQty += movement.quantity;
      current.lastIncomingAt = movement.createdAt.toISOString();
    } else {
      current.returnedToSupplierQty += movement.quantity;
      current.lastOutgoingAt = movement.createdAt.toISOString();
    }

    ledger.set(key, current);
  }

  return Array.from(ledger.values())
    .map((row) => ({
      ...row,
      remainingReturnQty: row.returnedInQty - row.returnedToSupplierQty,
    }))
    .filter((row) => row.returnedInQty > 0 || row.returnedToSupplierQty > 0)
    .sort((a, b) => {
      if (a.outletName !== b.outletName) return a.outletName.localeCompare(b.outletName);
      return a.item.name.localeCompare(b.item.name);
    });
};
