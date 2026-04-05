import { prisma } from '../../config/database';
import { AppError, notFound } from '../../shared/middleware/errorHandler';
import { TransferStatus, LocationType, MovementType } from '../../generated/prisma/enums';
import { getPaginationArgs } from '../../shared/utils/pagination';
import * as repo from './transfer.repository';
import * as invRepo from '../inventory/inventory.repository';
import type {
  CreateTransferInput,
  DispatchTransferInput,
  ReceiveTransferInput,
  CancelTransferInput,
  ListTransfersInput,
} from './transfer.schema';

// ---------------------------------------------------------------------------
// Transfer number generator — TRF-YYYYMMDD-XXXXXX
// ---------------------------------------------------------------------------
const generateTransferNo = (): string => {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `TRF-${date}-${suffix}`;
};

// ---------------------------------------------------------------------------
// Resolve and validate a location (outlet or warehouse)
// ---------------------------------------------------------------------------
async function resolveLocation(type: 'OUTLET' | 'WAREHOUSE', id: string, label: string) {
  if (type === 'OUTLET') {
    const outlet = await invRepo.findOutletById(id);
    if (!outlet || !outlet.isActive) throw notFound(`${label} outlet`);
    return outlet;
  }
  const warehouse = await invRepo.findWarehouseById(id);
  if (!warehouse || !warehouse.isActive) throw notFound(`${label} warehouse`);
  return warehouse;
}

// ===========================================================================
// Create transfer request
// ===========================================================================

export const createTransfer = async (input: CreateTransferInput, userId: string) => {
  // Validate both locations
  await Promise.all([
    resolveLocation(input.fromType, input.fromId, 'Source'),
    resolveLocation(input.toType,   input.toId,   'Destination'),
  ]);

  // Validate all items exist and are active
  const itemIds = input.items.map((i) => i.itemId);
  const dbItems = await invRepo.findItemsByIds(itemIds);
  if (dbItems.length !== itemIds.length) {
    throw new AppError('One or more items not found', 404);
  }
  const inactiveItem = dbItems.find((i) => !i.isActive);
  if (inactiveItem) {
    throw new AppError(`Item "${inactiveItem.name}" is inactive`, 400);
  }

  const transferNo = generateTransferNo();

  return prisma.$transaction(async (tx) =>
    repo.createTransferInTx(tx, {
      transferNo,
      fromType:      input.fromType as LocationType,
      fromId:        input.fromId,
      toType:        input.toType as LocationType,
      toId:          input.toId,
      note:          input.note,
      requestedById: userId,
      items:         input.items,
    }),
  );
};

// ===========================================================================
// Dispatch — deduct stock from source location
// ===========================================================================

export const dispatchTransfer = async (
  id: string,
  _input: DispatchTransferInput,
  userId: string,
) => {
  const transfer = await repo.findTransferById(id);
  if (!transfer) throw notFound('Transfer');

  if (transfer.status !== TransferStatus.PENDING) {
    throw new AppError(
      `Cannot dispatch a transfer with status ${transfer.status}. Must be PENDING.`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Check and deduct stock from source for every line
    for (const line of transfer.items) {
      if (transfer.fromType === LocationType.OUTLET) {
        const stock = await invRepo.getOutletStockInTx(tx, transfer.fromId, line.itemId);
        if (!stock || stock.quantity < line.quantity) {
          throw new AppError(
            `Insufficient stock for "${line.item.name}" at source (available: ${stock?.quantity ?? 0})`,
            400,
          );
        }
        await invRepo.upsertOutletStock(tx, transfer.fromId, line.itemId, -line.quantity);
      } else {
        const stock = await invRepo.getWarehouseStockInTx(tx, transfer.fromId, line.itemId);
        if (!stock || stock.quantity < line.quantity) {
          throw new AppError(
            `Insufficient stock for "${line.item.name}" at source warehouse (available: ${stock?.quantity ?? 0})`,
            400,
          );
        }
        await invRepo.upsertWarehouseStock(tx, transfer.fromId, line.itemId, -line.quantity);
      }
    }

    // Mark as dispatched
    await repo.dispatchTransferInTx(tx, id, userId);
  });

  return repo.findTransferById(id);
};

// ===========================================================================
// Receive — add stock to destination, record movements
// ===========================================================================

export const receiveTransfer = async (
  id: string,
  input: ReceiveTransferInput,
  userId: string,
) => {
  const transfer = await repo.findTransferById(id);
  if (!transfer) throw notFound('Transfer');

  if (transfer.status !== TransferStatus.DISPATCHED) {
    throw new AppError(
      `Cannot receive a transfer with status ${transfer.status}. Must be DISPATCHED.`,
      400,
    );
  }

  // Build a map of receivedQty by transferItemId for quick lookup
  const qtyMap = new Map(input.items.map((i) => [i.transferItemId, i.receivedQty]));

  // Validate all provided transferItemIds belong to this transfer
  const validIds = new Set(transfer.items.map((i) => i.id));
  for (const itemId of qtyMap.keys()) {
    if (!validIds.has(itemId)) {
      throw new AppError(`Transfer item ${itemId} does not belong to this transfer`, 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const line of transfer.items) {
      // If the caller provided a specific receivedQty use it; otherwise use requested qty
      const receivedQty = qtyMap.get(line.id) ?? line.quantity;

      // Update the per-line received qty
      await repo.updateTransferItemReceivedQtyInTx(tx, line.id, receivedQty);

      if (receivedQty === 0) continue;  // nothing to stock in for this line

      // Add to destination stock
      if (transfer.toType === LocationType.OUTLET) {
        await invRepo.upsertOutletStock(tx, transfer.toId, line.itemId, receivedQty);
      } else {
        await invRepo.upsertWarehouseStock(tx, transfer.toId, line.itemId, receivedQty);
      }

      // Record a TRANSFER stock movement for audit
      await invRepo.createMovement(tx, {
        movementType: MovementType.TRANSFER,
        quantity:     receivedQty,
        referenceId:  id,
        itemId:       line.itemId,
        fromType:     transfer.fromType as LocationType,
        fromId:       transfer.fromId,
        toType:       transfer.toType as LocationType,
        toId:         transfer.toId,
        note:         `Transfer ${transfer.transferNo}`,
        createdBy:    userId,
      });
    }

    await repo.receiveTransferInTx(tx, id, userId);
  });

  return repo.findTransferById(id);
};

// ===========================================================================
// Cancel — only PENDING transfers can be cancelled (no stock was touched yet)
// ===========================================================================

export const cancelTransfer = async (
  id: string,
  _input: CancelTransferInput,
  userId: string,
) => {
  const transfer = await repo.findTransferById(id);
  if (!transfer) throw notFound('Transfer');

  if (transfer.status !== TransferStatus.PENDING) {
    throw new AppError(
      `Cannot cancel a transfer with status ${transfer.status}. Only PENDING transfers can be cancelled.`,
      400,
    );
  }

  // Only the person who requested it (or a manager) cancels it.
  // Permission-level enforcement is already done via authorize() in the route.
  await prisma.$transaction(async (tx) => {
    await repo.cancelTransferInTx(tx, id);
  });

  return repo.findTransferById(id);
};

// ===========================================================================
// Reads
// ===========================================================================

export const getTransferById = async (id: string) => {
  const transfer = await repo.findTransferById(id);
  if (!transfer) throw notFound('Transfer');
  return transfer;
};

export const getTransferByNo = async (transferNo: string) => {
  const transfer = await repo.findTransferByNo(transferNo);
  if (!transfer) throw notFound('Transfer');
  return transfer;
};

export const listTransfers = async (input: ListTransfersInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [data, total] = await repo.listTransfers(skip, take, {
    status:   input.status,
    fromId:   input.fromId,
    toId:     input.toId,
    fromDate: input.fromDate,
    toDate:   input.toDate,
  });
  return { data, total, page: input.page, limit: input.limit };
};
