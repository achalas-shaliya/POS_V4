import { prisma } from '../../config/database';
import { AppError, notFound, conflict } from '../../shared/middleware/errorHandler';
import { MovementType, LocationType, SaleStatus } from '../../generated/prisma/enums';
import { getPaginationArgs } from '../../shared/utils/pagination';
import * as repo from './sales.repository';
import * as invRepo from '../inventory/inventory.repository';
import { recordCashFromPayment } from '../cash/cash.service';
import type {
  CheckoutInput,
  VoidSaleInput,
  CreateCustomerInput,
  ListSalesInput,
  ListCustomersInput,
} from './sales.schema';

// ---------------------------------------------------------------------------
// Receipt number — e.g. RCP-20260329-1K7P3Q
// Stored with @unique; the extremely low collision chance is caught by P2002.
// ---------------------------------------------------------------------------
const generateReceiptNo = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `RCP-${date}-${suffix}`;
};

// Payment transaction number — e.g. PAY-20260329-1K7P3Q
const generatePaymentTxNo = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = (Date.now() + 1).toString(36).toUpperCase().slice(-6); // +1 avoids collision with receiptNo
  return `PAY-${date}-${suffix}`;
};

// ---------------------------------------------------------------------------
// Checkout — the core POS transaction
// All stock checks, deductions, sale creation, and payment recording happen
// inside a single $transaction so the DB stays consistent on any failure.
// ---------------------------------------------------------------------------
export const checkout = async (data: CheckoutInput, userId: string) => {
  // ── 0. Verify cashier session is still valid ───────────────────────────────
  const cashier = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
  if (!cashier || !cashier.isActive) {
    throw new AppError('Your session is invalid. Please log out and log in again.', 401);
  }

  // ── 1. Validate outlet ────────────────────────────────────────────────────
  const outlet = await invRepo.findOutletById(data.outletId);
  if (!outlet || !outlet.isActive) throw notFound('Outlet');

  // ── 2. Resolve items from DB (batch-fetch) ────────────────────────────────
  const itemIds = data.items.map((i) => i.itemId);
  const dbItems = await invRepo.findItemsByIds(itemIds);
  const itemMap = new Map(dbItems.map((i) => [i.id, i]));

  if (dbItems.length !== itemIds.length) {
    throw new AppError('One or more items not found', 404);
  }

  // ── 3. Build line items with locked prices ────────────────────────────────
  const lineItems = data.items.map((line) => {
    const dbItem = itemMap.get(line.itemId)!;
    if (!dbItem.isActive) {
      throw new AppError(`Item "${dbItem.name}" is inactive`, 400);
    }
    const unitPrice = line.unitPrice ?? Number(dbItem.sellingPrice);
    const discount = line.discount ?? 0;
    if (discount > unitPrice) {
      throw new AppError(
        `Discount (${discount}) exceeds unit price (${unitPrice}) for "${dbItem.name}"`,
        400,
      );
    }
    const lineSubtotal = (unitPrice - discount) * line.quantity;
    return {
      itemId: line.itemId,
      quantity: line.quantity,
      unitPrice,
      discount,
      subtotal: lineSubtotal,
    };
  });

  // ── 4. Compute sale totals ────────────────────────────────────────────────
  const subtotal = lineItems.reduce((acc, l) => acc + l.subtotal, 0);
  const discountAmt = data.discountAmt ?? 0;
  const total = subtotal - discountAmt;
  if (total < 0) throw new AppError('Sale total cannot be negative', 400);

  // ── 5. Validate payments ──────────────────────────────────────────────────
  validatePayments(data.payments, total);

  const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const change = parseFloat((totalPaid - total).toFixed(2));

  // Build payment rows — change is assigned to the first CASH leg
  let changeRemaining = change;
  const paymentRows = data.payments.map((p) => {
    let changeForLeg = 0;
    if (p.method === 'CASH' && changeRemaining > 0) {
      changeForLeg = changeRemaining;
      changeRemaining = 0;
    }
    return {
      method: p.method,
      amount: p.amount,
      change: changeForLeg,
      reference: p.reference,
    };
  });

  // ── 6. One receipt number per attempt (retry handled by caller if needed) ─
  const receiptNo = generateReceiptNo();
  const paymentTxNo = generatePaymentTxNo();

  // ── 7. Atomic transaction ─────────────────────────────────────────────────
  const sale = await prisma.$transaction(async (tx) => {
    // Check & decrement stock for every line inside the transaction
    for (const line of lineItems) {
      const stock = await invRepo.getOutletStockInTx(tx, data.outletId, line.itemId);
      if (!stock || stock.quantity < line.quantity) {
        const name = itemMap.get(line.itemId)!.name;
        throw new AppError(
          `Insufficient stock for "${name}" (available: ${stock?.quantity ?? 0})`,
          400,
        );
      }
      await invRepo.upsertOutletStock(tx, data.outletId, line.itemId, -line.quantity);
    }

    // Persist sale + items + single payment transaction (with per-method legs)
    const saleRecord = await repo.createSaleInTx(tx, {
      receiptNo,
      outletId: data.outletId,
      cashierId: userId,
      customerId: data.customerId,
      note: data.note,
      subtotal,
      discountAmt,
      total,
      items: lineItems,
      payment: {
        txNo: paymentTxNo,
        totalAmount: totalPaid,
        totalChange: change,
        legs: paymentRows,
      },
    });

    // Record a SALE movement per line item for audit trail
    for (const line of lineItems) {
      await invRepo.createMovement(tx, {
        movementType: MovementType.SALE,
        quantity: line.quantity,
        referenceId: saleRecord.id,
        itemId: line.itemId,
        fromType: LocationType.OUTLET,
        fromId: data.outletId,
        createdBy: userId,
      });
    }

    return saleRecord;
  });

  // Post-transaction: record cash inflow in the cashier's open register (if any).
  // Intentionally outside the sale transaction — a missing register must not
  // roll back a completed sale.
  await recordSaleCash({
    id: sale.id,
    payments: sale.payments.map((pt) => ({
      legs: pt.legs.map((l) => ({
        method: l.method,
        amount: Number(l.amount),
        change: Number(l.change),
      })),
    })),
  }, userId);

  return sale;
};

const recordSaleCash = async (
  sale: { id: string; payments: Array<{ legs: Array<{ method: string; amount: number; change: number }> }> },
  userId: string,
) => {
  const allLegs = sale.payments.flatMap((pt) => pt.legs ?? []);
  const cashLegs = allLegs.filter((l) => l.method === 'CASH');
  const netCash = cashLegs.reduce((sum, l) => sum + l.amount - l.change, 0);
  if (netCash <= 0) return;

  try {
    await recordCashFromPayment({
      userId,
      entityType: 'SALE',
      netAmount: parseFloat(netCash.toFixed(2)),
      referenceId: sale.id,
      note: 'Sale cash',
    });
  } catch {
    // No open register — silently skip
  }
};
export const voidSale = async (id: string, input: VoidSaleInput, userId: string) => {
  const sale = await repo.findSaleById(id);
  if (!sale) throw notFound('Sale');
  if (sale.status === SaleStatus.VOIDED) throw conflict('Sale is already voided');

  await prisma.$transaction(async (tx) => {
    // Restore stock and create RETURN movements for each line
    for (const line of sale.items) {
      await invRepo.upsertOutletStock(tx, sale.outletId, line.itemId, line.quantity);
      await invRepo.createMovement(tx, {
        movementType: MovementType.RETURN,
        quantity: line.quantity,
        referenceId: sale.id,
        itemId: line.itemId,
        toType: LocationType.OUTLET,
        toId: sale.outletId,
        note: `Void — ${input.reason}`,
        createdBy: userId,
      });
    }

    await repo.voidSaleInTx(tx, id, userId, input.reason);
  });
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getSaleById = async (id: string) => {
  const sale = await repo.findSaleById(id);
  if (!sale) throw notFound('Sale');
  return sale;
};

export const getSaleByReceiptNo = async (receiptNo: string) => {
  const sale = await repo.findSaleByReceiptNo(receiptNo);
  if (!sale) throw notFound('Sale');
  return sale;
};

export const listSales = async (input: ListSalesInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [data, total] = await repo.listSales(skip, take, {
    outletId: input.outletId,
    cashierId: input.cashierId,
    customerId: input.customerId,
    status: input.status,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });
  return { data, total, page: input.page, limit: input.limit };
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const createCustomer = async (data: CreateCustomerInput) => {
  const existing = await repo.findCustomerByPhone(data.phone);
  if (existing) throw conflict(`Customer with phone "${data.phone}" already exists`);
  return repo.createCustomer(data);
};

export const listCustomers = async (input: ListCustomersInput) => {
  const { skip, take, search } = getPaginationArgs(input);
  const [data, total] = await repo.listCustomers(skip, take, search);
  return { data, total, page: input.page, limit: input.limit };
};

// ---------------------------------------------------------------------------
// Payment validation helper
// ---------------------------------------------------------------------------
function validatePayments(
  payments: { method: string; amount: number; reference?: string }[],
  total: number,
) {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  if (totalPaid < total) {
    throw new AppError(
      `Underpayment: sale total is ${total.toFixed(2)}, paid ${totalPaid.toFixed(2)}`,
      400,
    );
  }

  const change = totalPaid - total;
  const hasCash = payments.some((p) => p.method === 'CASH');

  if (change > 0 && !hasCash) {
    throw new AppError(
      'Overpayment without a CASH leg — no change can be given for card-only payments',
      400,
    );
  }

  // Each CARD payment must carry a reference in a real POS,
  // but we leave it optional (some integrations post-reconcile separately).
}
