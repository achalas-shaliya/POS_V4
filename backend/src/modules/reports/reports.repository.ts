/**
 * reports.repository.ts
 *
 * All aggregation queries for the Reports module.
 * Every function executes a raw `prisma.$queryRaw` or uses the typed query
 * API to produce aggregated rows — never fetches full entity lists for reporting
 * purposes (keeps memory footprint small and allows DB-level aggregation).
 */

import { prisma } from '../../config/database';
import { Prisma } from '../../generated/prisma/client';
import type {
  SalesSummaryInput,
  SalesByPeriodInput,
  TopItemsInput,
  RepairSummaryInput,
  RepairTurnaroundInput,
  InventorySnapshotInput,
  InventoryMovementsInput,
  CashSummaryInput,
  CashVarianceInput,
} from './reports.schema';
import { getPaginationArgs } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseDate = (d: string) => new Date(d);

const dateFilter = (
  fromDate?: string,
  toDate?:   string,
): { gte?: Date; lte?: Date } | undefined => {
  if (!fromDate && !toDate) return undefined;
  return {
    ...(fromDate && { gte: parseDate(fromDate) }),
    ...(toDate   && { lte: parseDate(toDate) }),
  };
};

// ===========================================================================
// SALES REPORTS
// ===========================================================================

/**
 * Aggregate totals across all (COMPLETED) sales for the given period / outlet.
 */
export const getSalesSummary = async (input: SalesSummaryInput) => {
  const createdAt = dateFilter(input.fromDate, input.toDate);

  const [totals, byPaymentMethod, returnStats] = await Promise.all([
    // Overall revenue metrics
    prisma.sale.aggregate({
      where: {
        status: 'COMPLETED',
        ...(input.outletId && { outletId: input.outletId }),
        ...(createdAt && { createdAt }),
      },
      _count: { id: true },
      _sum:   { total: true, discountAmt: true },
      _avg:   { total: true },
    }),

    // Breakdown by payment leg method
    prisma.$queryRaw<{ method: string; total: number; txCount: number }[]>`
      SELECT pl.method,
             SUM(pl.amount - pl.change) AS total,
             COUNT(DISTINCT pt.id)      AS txCount
      FROM   payment_legs       pl
      JOIN   payment_transactions pt ON pt.id = pl.transaction_id
      JOIN   sales s                 ON s.id  = pt.sale_id
      WHERE  s.status = 'COMPLETED'
        ${input.outletId  ? Prisma.sql`AND s.outlet_id  = ${input.outletId}`  : Prisma.empty}
        ${input.fromDate  ? Prisma.sql`AND s.created_at >= ${parseDate(input.fromDate)}` : Prisma.empty}
        ${input.toDate    ? Prisma.sql`AND s.created_at <= ${parseDate(input.toDate)}`   : Prisma.empty}
      GROUP BY pl.method
    `,

    // Voided sales count
    prisma.sale.count({
      where: {
        status: 'VOIDED',
        ...(input.outletId && { outletId: input.outletId }),
        ...(createdAt && { createdAt }),
      },
    }),
  ]);

  return {
    totalSales:         totals._count.id,
    totalRevenue:       Number(totals._sum.total ?? 0),
    totalDiscounts:     Number(totals._sum.discountAmt ?? 0),
    avgOrderValue:      Number(totals._avg.total ?? 0),
    voidedSales:        returnStats,
    byPaymentMethod:    byPaymentMethod.map((r) => ({
      method:   r.method,
      total:    Number(r.total),
      txCount:  Number(r.txCount),
    })),
  };
};

/**
 * Revenue grouped by day / week / month for trend charts.
 */
export const getSalesByPeriod = async (input: SalesByPeriodInput) => {
  const formatExpr =
    input.groupBy === 'day'
      ? Prisma.sql`DATE_FORMAT(s.created_at, '%Y-%m-%d')`
      : input.groupBy === 'week'
      ? Prisma.sql`DATE_FORMAT(s.created_at, '%x-W%v')`
      : Prisma.sql`DATE_FORMAT(s.created_at, '%Y-%m')`;

  const rows = await prisma.$queryRaw<
    { period: string; revenue: number; orderCount: number; avgOrder: number; discount: number }[]
  >`
    SELECT ${formatExpr}    AS period,
           SUM(s.total)     AS revenue,
           COUNT(s.id)      AS orderCount,
           AVG(s.total)     AS avgOrder,
           SUM(s.discount_amt) AS discount
    FROM   sales s
    WHERE  s.status = 'COMPLETED'
      ${input.outletId ? Prisma.sql`AND s.outlet_id  = ${input.outletId}` : Prisma.empty}
      ${input.fromDate ? Prisma.sql`AND s.created_at >= ${parseDate(input.fromDate)}` : Prisma.empty}
      ${input.toDate   ? Prisma.sql`AND s.created_at <= ${parseDate(input.toDate)}`   : Prisma.empty}
    GROUP BY period
    ORDER BY period ASC
  `;

  return rows.map((r) => ({
    period:     r.period,
    revenue:    Number(r.revenue),
    orderCount: Number(r.orderCount),
    avgOrder:   Number(r.avgOrder),
    discount:   Number(r.discount ?? 0),
  }));
};

/**
 * Top N items by revenue / quantity sold.
 */
export const getTopSellingItems = async (input: TopItemsInput) => {
  const rows = await prisma.$queryRaw<
    {
      itemId:      string;
      sku:         string;
      name:        string;
      totalQty:    number;
      totalRevenue: number;
      orderCount:  number;
    }[]
  >`
    SELECT si.item_id          AS itemId,
           i.sku,
           i.name,
           SUM(si.quantity)    AS totalQty,
           SUM(si.subtotal)    AS totalRevenue,
           COUNT(DISTINCT si.sale_id) AS orderCount
    FROM   sale_items si
    JOIN   items i ON i.id = si.item_id
    JOIN   sales s ON s.id = si.sale_id
    WHERE  s.status = 'COMPLETED'
      ${input.outletId ? Prisma.sql`AND s.outlet_id  = ${input.outletId}` : Prisma.empty}
      ${input.fromDate ? Prisma.sql`AND s.created_at >= ${parseDate(input.fromDate)}` : Prisma.empty}
      ${input.toDate   ? Prisma.sql`AND s.created_at <= ${parseDate(input.toDate)}`   : Prisma.empty}
    GROUP BY si.item_id, i.sku, i.name
    ORDER BY totalRevenue DESC
    LIMIT ${input.limit}
  `;

  return rows.map((r) => ({
    itemId:       r.itemId,
    sku:          r.sku,
    name:         r.name,
    totalQty:     Number(r.totalQty),
    totalRevenue: Number(r.totalRevenue),
    orderCount:   Number(r.orderCount),
  }));
};

// ===========================================================================
// REPAIR REPORTS
// ===========================================================================

/**
 * Aggregate repair job counts and revenue by status.
 */
export const getRepairSummary = async (input: RepairSummaryInput) => {
  const createdAt = dateFilter(input.fromDate, input.toDate);

  const [byStatus, revenue, partsCost] = await Promise.all([
    // Count by status
    prisma.repairJob.groupBy({
      by: ['status'],
      where: {
        ...(input.outletId     && { outletId:    input.outletId }),
        ...(input.technicianId && { technicianId: input.technicianId }),
        ...(createdAt && { createdAt }),
      },
      _count: { id: true },
    }),

    // Revenue (all paid amounts)
    prisma.paymentTransaction.aggregate({
      where: {
        repairJob: {
          ...(input.outletId     && { outletId:    input.outletId }),
          ...(input.technicianId && { technicianId: input.technicianId }),
          ...(createdAt && { createdAt }),
        },
      },
      _sum: { totalAmount: true },
    }),

    // Parts cost
    prisma.repairPart.aggregate({
      where: {
        repair: {
          ...(input.outletId     && { outletId:    input.outletId }),
          ...(input.technicianId && { technicianId: input.technicianId }),
          ...(createdAt && { createdAt }),
        },
      },
      _sum: { subtotal: true },
    }),
  ]);

  return {
    byStatus: byStatus.map((r) => ({
      status: r.status,
      count:  r._count.id,
    })),
    totalRevenue:  Number(revenue._sum.totalAmount ?? 0),
    totalPartsCost: Number(partsCost._sum.subtotal ?? 0),
  };
};

/**
 * Average turnaround time per technician (from createdAt → completedAt).
 */
export const getRepairTurnaround = async (input: RepairTurnaroundInput) => {
  const rows = await prisma.$queryRaw<
    {
      technicianId: string | null;
      technicianName: string | null;
      jobCount: number;
      avgHours: number;
    }[]
  >`
    SELECT rj.technician_id                                            AS technicianId,
           u.full_name                                                 AS technicianName,
           COUNT(rj.id)                                               AS jobCount,
           AVG(TIMESTAMPDIFF(HOUR, rj.created_at, rj.completed_at))  AS avgHours
    FROM   repair_jobs rj
    LEFT JOIN users u ON u.id = rj.technician_id
    WHERE  rj.completed_at IS NOT NULL
      ${input.outletId     ? Prisma.sql`AND rj.outlet_id      = ${input.outletId}`     : Prisma.empty}
      ${input.technicianId ? Prisma.sql`AND rj.technician_id  = ${input.technicianId}` : Prisma.empty}
      ${input.fromDate     ? Prisma.sql`AND rj.created_at    >= ${parseDate(input.fromDate)}` : Prisma.empty}
      ${input.toDate       ? Prisma.sql`AND rj.created_at    <= ${parseDate(input.toDate)}`   : Prisma.empty}
    GROUP BY rj.technician_id, u.full_name
    ORDER BY avgHours ASC
  `;

  return rows.map((r) => ({
    technicianId:   r.technicianId,
    technicianName: r.technicianName,
    jobCount:       Number(r.jobCount),
    avgHours:       r.avgHours !== null ? Number(r.avgHours) : null,
  }));
};

// ===========================================================================
// INVENTORY REPORTS
// ===========================================================================

/**
 * Current stock snapshot (outlet or warehouse level).
 * Returns item-level stock with cost and estimated value.
 */
export const getInventorySnapshot = async (input: InventorySnapshotInput) => {
  if (input.outletId) {
    // Outlet stock
    const rows = await prisma.outletStock.findMany({
      where: {
        outletId: input.outletId,
        ...(input.lowStockOnly && {
          quantity: { lte: prisma.outletStock.fields.minQuantity },
        }),
      },
      include: {
        item: {
          select: {
            id:           true,
            sku:          true,
            name:         true,
            costPrice:    true,
            sellingPrice: true,
            category:     { select: { id: true, name: true } },
          },
        },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { item: { name: 'asc' } },
    });

    return rows.map((r) => ({
      location:     { type: 'OUTLET', id: r.outletId, name: r.outlet.name },
      itemId:       r.itemId,
      sku:          r.item.sku,
      name:         r.item.name,
      category:     r.item.category.name,
      quantity:     r.quantity,
      minQuantity:  r.minQuantity,
      isLowStock:   r.quantity <= r.minQuantity,
      costPrice:    Number(r.item.costPrice),
      sellingPrice: Number(r.item.sellingPrice),
      stockValue:   Number(r.item.costPrice) * r.quantity,
    }));
  }

  if (input.warehouseId) {
    // Warehouse stock
    const rows = await prisma.warehouseStock.findMany({
      where: {
        warehouseId: input.warehouseId,
        ...(input.lowStockOnly && {
          quantity: { lte: prisma.warehouseStock.fields.minQuantity },
        }),
      },
      include: {
        item: {
          select: {
            id:           true,
            sku:          true,
            name:         true,
            costPrice:    true,
            sellingPrice: true,
            category:     { select: { id: true, name: true } },
          },
        },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { item: { name: 'asc' } },
    });

    return rows.map((r) => ({
      location:     { type: 'WAREHOUSE', id: r.warehouseId, name: r.warehouse.name },
      itemId:       r.itemId,
      sku:          r.item.sku,
      name:         r.item.name,
      category:     r.item.category.name,
      quantity:     r.quantity,
      minQuantity:  r.minQuantity,
      isLowStock:   r.quantity <= r.minQuantity,
      costPrice:    Number(r.item.costPrice),
      sellingPrice: Number(r.item.sellingPrice),
      stockValue:   Number(r.item.costPrice) * r.quantity,
    }));
  }

  // No filter — aggregate totals across all locations
  const [outletTotals, warehouseTotals] = await Promise.all([
    prisma.$queryRaw<{ totalItems: number; totalStockValue: number; lowStockCount: number }[]>`
      SELECT COUNT(DISTINCT os.item_id)                                   AS totalItems,
             SUM(os.quantity * i.cost_price)                              AS totalStockValue,
             SUM(CASE WHEN os.quantity <= os.min_quantity THEN 1 ELSE 0 END) AS lowStockCount
      FROM outlet_stock os
      JOIN items i ON i.id = os.item_id
    `,
    prisma.$queryRaw<{ totalItems: number; totalStockValue: number; lowStockCount: number }[]>`
      SELECT COUNT(DISTINCT ws.item_id)                                   AS totalItems,
             SUM(ws.quantity * i.cost_price)                              AS totalStockValue,
             SUM(CASE WHEN ws.quantity <= ws.min_quantity THEN 1 ELSE 0 END) AS lowStockCount
      FROM warehouse_stock ws
      JOIN items i ON i.id = ws.item_id
    `,
  ]);

  const o = outletTotals[0];
  const w = warehouseTotals[0];
  return {
    outlets:    { totalItems: Number(o?.totalItems ?? 0), totalStockValue: Number(o?.totalStockValue ?? 0), lowStockCount: Number(o?.lowStockCount ?? 0) },
    warehouses: { totalItems: Number(w?.totalItems ?? 0), totalStockValue: Number(w?.totalStockValue ?? 0), lowStockCount: Number(w?.lowStockCount ?? 0) },
  };
};

/**
 * Paginated stock movement log with optional filters.
 */
export const getInventoryMovements = async (input: InventoryMovementsInput) => {
  const { skip, take } = getPaginationArgs(input);
  const where: Prisma.StockMovementWhereInput = {
    ...(input.itemId       && { itemId:       input.itemId }),
    ...(input.movementType && { movementType: input.movementType as any }),
    ...((input.fromDate || input.toDate) && {
      createdAt: {
        ...(input.fromDate && { gte: parseDate(input.fromDate) }),
        ...(input.toDate   && { lte: parseDate(input.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      skip,
      take,
      include: {
        item:          { select: { id: true, sku: true, name: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.count({ where }),
  ]);
};

// ===========================================================================
// CASH REGISTER REPORTS
// ===========================================================================

/**
 * Cash flow summary: totals by movement type, net cash across registers.
 */
export const getCashSummary = async (input: CashSummaryInput) => {
  const openedAt = dateFilter(input.fromDate, input.toDate);

  const [registerStats, byType] = await Promise.all([
    // Register-level aggregation
    prisma.cashRegister.aggregate({
      where: {
        ...(input.outletId && { outletId:   input.outletId }),
        ...(input.userId   && { openedById: input.userId }),
        ...(openedAt && { openedAt }),
      },
      _count: { id: true },
      _sum:   { openingBalance: true, actualCash: true, expectedCash: true, difference: true },
    }),

    // Per movement-type totals
    prisma.$queryRaw<{ type: string; total: number; count: number }[]>`
      SELECT cm.type,
             SUM(cm.amount) AS total,
             COUNT(cm.id)   AS count
      FROM   cash_movements cm
      JOIN   cash_registers cr ON cr.id = cm.register_id
      WHERE  1=1
        ${input.outletId ? Prisma.sql`AND cr.outlet_id   = ${input.outletId}` : Prisma.empty}
        ${input.userId   ? Prisma.sql`AND cr.opened_by_id = ${input.userId}`  : Prisma.empty}
        ${input.fromDate ? Prisma.sql`AND cr.opened_at   >= ${parseDate(input.fromDate)}` : Prisma.empty}
        ${input.toDate   ? Prisma.sql`AND cr.opened_at   <= ${parseDate(input.toDate)}`   : Prisma.empty}
      GROUP BY cm.type
      ORDER BY total DESC
    `,
  ]);

  return {
    registerCount:    registerStats._count.id,
    totalOpening:     Number(registerStats._sum.openingBalance ?? 0),
    totalExpected:    Number(registerStats._sum.expectedCash   ?? 0),
    totalActual:      Number(registerStats._sum.actualCash     ?? 0),
    totalDifference:  Number(registerStats._sum.difference     ?? 0),
    byMovementType:   byType.map((r) => ({
      type:  r.type,
      total: Number(r.total),
      count: Number(r.count),
    })),
  };
};

/**
 * Paginated list of closed register sessions with expected vs actual variance.
 */
export const getCashVariance = async (input: CashVarianceInput) => {
  const skip = (input.page - 1) * input.limit;
  const take = input.limit;

  const where: Prisma.CashRegisterWhereInput = {
    status: 'CLOSED',
    ...(input.outletId && { outletId:   input.outletId }),
    ...(input.userId   && { openedById: input.userId }),
    ...((input.fromDate || input.toDate) && {
      openedAt: {
        ...(input.fromDate && { gte: parseDate(input.fromDate) }),
        ...(input.toDate   && { lte: parseDate(input.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.cashRegister.findMany({
      where,
      skip,
      take,
      select: {
        id:             true,
        openedAt:       true,
        closedAt:       true,
        openingBalance: true,
        expectedCash:   true,
        actualCash:     true,
        difference:     true,
        closingNote:    true,
        outlet:    { select: { id: true, name: true } },
        openedBy:  { select: { id: true, fullName: true } },
        closedBy:  { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
    }),
    prisma.cashRegister.count({ where }),
  ]);
};
