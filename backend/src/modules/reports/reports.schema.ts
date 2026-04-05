import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Common date-range filter (shared by all reports)
// ---------------------------------------------------------------------------
const dateRangeSchema = z.object({
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate:   z.string().datetime({ offset: true }).optional(),
  outletId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Sales summary report  — GET /api/v1/reports/sales/summary
// ---------------------------------------------------------------------------
export const salesSummarySchema = dateRangeSchema;

// ---------------------------------------------------------------------------
// Sales by period  — GET /api/v1/reports/sales/by-period
// ---------------------------------------------------------------------------
export const salesByPeriodSchema = dateRangeSchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// ---------------------------------------------------------------------------
// Top-selling items  — GET /api/v1/reports/sales/top-items
// ---------------------------------------------------------------------------
export const topItemsSchema = dateRangeSchema.extend({
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// ---------------------------------------------------------------------------
// Repair summary  — GET /api/v1/reports/repairs/summary
// ---------------------------------------------------------------------------
export const repairSummarySchema = dateRangeSchema.extend({
  technicianId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Repair turnaround (avg resolution time by technician)
// ---------------------------------------------------------------------------
export const repairTurnaroundSchema = dateRangeSchema.extend({
  technicianId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Inventory snapshot  — GET /api/v1/reports/inventory/snapshot
// ---------------------------------------------------------------------------
export const inventorySnapshotSchema = z.object({
  outletId:     z.string().uuid().optional(),
  warehouseId:  z.string().uuid().optional(),
  lowStockOnly: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Inventory movement report  — GET /api/v1/reports/inventory/movements
// ---------------------------------------------------------------------------
export const inventoryMovementsSchema = paginationSchema.extend({
  fromDate:     z.string().datetime({ offset: true }).optional(),
  toDate:       z.string().datetime({ offset: true }).optional(),
  movementType: z
    .enum(['SALE', 'RETURN', 'TRANSFER', 'ADJUSTMENT', 'PURCHASE'])
    .optional(),
  itemId:       z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Cash register report  — GET /api/v1/reports/cash/summary
// ---------------------------------------------------------------------------
export const cashSummarySchema = dateRangeSchema.extend({
  userId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Cash register variance (actual vs expected per session)
// ---------------------------------------------------------------------------
export const cashVarianceSchema = dateRangeSchema.extend({
  userId: z.string().uuid().optional(),
  limit:  z.coerce.number().int().positive().max(100).default(20),
  page:   z.coerce.number().int().positive().default(1),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------
export type SalesSummaryInput       = z.infer<typeof salesSummarySchema>;
export type SalesByPeriodInput      = z.infer<typeof salesByPeriodSchema>;
export type TopItemsInput           = z.infer<typeof topItemsSchema>;
export type RepairSummaryInput      = z.infer<typeof repairSummarySchema>;
export type RepairTurnaroundInput   = z.infer<typeof repairTurnaroundSchema>;
export type InventorySnapshotInput  = z.infer<typeof inventorySnapshotSchema>;
export type InventoryMovementsInput = z.infer<typeof inventoryMovementsSchema>;
export type CashSummaryInput        = z.infer<typeof cashSummarySchema>;
export type CashVarianceInput       = z.infer<typeof cashVarianceSchema>;
