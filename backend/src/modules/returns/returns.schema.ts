import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Return reasons
// ---------------------------------------------------------------------------
export const RETURN_REASONS = [
  'DEFECTIVE',
  'WRONG_ITEM',
  'CUSTOMER_CHANGE_MIND',
  'DAMAGED_IN_TRANSIT',
  'OTHER',
] as const;

// ---------------------------------------------------------------------------
// One line item in a return request
// ---------------------------------------------------------------------------
const returnItemSchema = z.object({
  saleItemId: z.string().uuid(),
  quantity:   z.number().int().positive('Quantity must be a positive integer'),
});

// ---------------------------------------------------------------------------
// Create return request
// ---------------------------------------------------------------------------
export const createReturnSchema = z.object({
  saleId:   z.string().uuid(),
  outletId: z.string().uuid(),
  reason:   z.enum(RETURN_REASONS),
  note:     z.string().max(500).optional(),
  items:    z.array(returnItemSchema).min(1, 'At least one item is required'),
});

// ---------------------------------------------------------------------------
// Approve return — manager action
// ---------------------------------------------------------------------------
export const approveReturnSchema = z.object({
  note: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Reject return — manager action
// ---------------------------------------------------------------------------
export const rejectReturnSchema = z.object({
  note: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export const listReturnsSchema = paginationSchema.extend({
  status:   z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  outletId: z.string().uuid().optional(),
  saleId:   z.string().uuid().optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate:   z.string().datetime({ offset: true }).optional(),
});

export const createSupplierReturnSchema = z.object({
  outletId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  supplierName: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

export const listSupplierReturnsSchema = paginationSchema.extend({
  outletId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate: z.string().datetime({ offset: true }).optional(),
});

export const listReturnStockSchema = z.object({
  outletId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
});

export const returnIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const returnNoParamSchema = z.object({
  returnNo: z.string().min(1).max(100),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CreateReturnInput  = z.infer<typeof createReturnSchema>;
export type ApproveReturnInput = z.infer<typeof approveReturnSchema>;
export type RejectReturnInput  = z.infer<typeof rejectReturnSchema>;
export type ListReturnsInput   = z.infer<typeof listReturnsSchema>;
export type CreateSupplierReturnInput = z.infer<typeof createSupplierReturnSchema>;
export type ListSupplierReturnsInput = z.infer<typeof listSupplierReturnsSchema>;
export type ListReturnStockInput = z.infer<typeof listReturnStockSchema>;
