import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export const createItemSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  type: z.enum(['ACCESSORY', 'SPARE_PART', 'TOOL']).default('ACCESSORY'),
  unit: z.enum(['PIECE', 'BOX', 'SET', 'PAIR']).default('PIECE'),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  discountPrice: z.number().min(0).default(0),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const listItemsSchema = paginationSchema.extend({
  type: z.enum(['ACCESSORY', 'SPARE_PART', 'TOOL']).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  parentId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
export const createBrandSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------
export const createWarehouseSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------
export const createOutletSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
});

// ---------------------------------------------------------------------------
// Stock operations
// ---------------------------------------------------------------------------
export const purchaseStockSchema = z.object({
  warehouseId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

export const transferStockSchema = z
  .object({
    fromType: z.enum(['WAREHOUSE', 'OUTLET']),
    fromId: z.string().uuid(),
    toType: z.enum(['WAREHOUSE', 'OUTLET']),
    toId: z.string().uuid(),
    itemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    note: z.string().max(500).optional(),
  })
  .refine((d) => !(d.fromType === d.toType && d.fromId === d.toId), {
    message: 'Source and destination cannot be the same location',
  });

export const adjustStockSchema = z.object({
  locationType: z.enum(['WAREHOUSE', 'OUTLET']),
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  newQuantity: z.number().int().nonnegative(),
  note: z.string().max(500).optional(),
});

export const setMinStockSchema = z.object({
  locationType: z.enum(['WAREHOUSE', 'OUTLET']),
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  minQuantity: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Stock movements filter
// ---------------------------------------------------------------------------
export const listMovementsSchema = paginationSchema.extend({
  itemId: z.string().uuid().optional(),
  movementType: z
    .enum(['PURCHASE', 'TRANSFER', 'SALE', 'RETURN', 'ADJUSTMENT'])
    .optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate: z.string().datetime({ offset: true }).optional(),
});

export const stockFilterSchema = paginationSchema.extend({
  lowStockOnly: z.coerce.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsInput = z.infer<typeof listItemsSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateOutletInput = z.infer<typeof createOutletSchema>;
export type PurchaseStockInput = z.infer<typeof purchaseStockSchema>;
export type TransferStockInput = z.infer<typeof transferStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type SetMinStockInput = z.infer<typeof setMinStockSchema>;
export type ListMovementsInput = z.infer<typeof listMovementsSchema>;
export type StockFilterInput = z.infer<typeof stockFilterSchema>;
