import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Shared: a single payment leg (one method + amount)
// ---------------------------------------------------------------------------
const paymentLegSchema = z.object({
  method:    z.enum(['CASH', 'CARD']),
  amount:    z.number().positive('Amount must be positive'),
  reference: z.string().max(100).optional(),  // card terminal ref — CASH only if blank
});

// ---------------------------------------------------------------------------
// Record payment for a Sale (additional / split payment)
// Use this when a sale was created with deferred/partial payment.
// ---------------------------------------------------------------------------
export const recordSalePaymentSchema = z.object({
  saleId:   z.string().uuid(),
  payments: z.array(paymentLegSchema).min(1, 'At least one payment leg required'),
  note:     z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Record payment for a Repair job (advance OR settlement)
// ---------------------------------------------------------------------------
export const recordRepairPaymentSchema = z.object({
  payments: z.array(paymentLegSchema).min(1, 'At least one payment leg required'),
  note:     z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Settle a repair job: pay remaining balance and mark DELIVERED atomically
// ---------------------------------------------------------------------------
export const settleRepairSchema = z.object({
  payments: z.array(paymentLegSchema).min(1, 'At least one payment leg required'),
  note:     z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Query / list
// ---------------------------------------------------------------------------
export const listPaymentsSchema = paginationSchema.extend({
  entityType: z.enum(['SALE', 'REPAIR']).optional(),
  fromDate:   z.string().datetime({ offset: true }).optional(),
  toDate:     z.string().datetime({ offset: true }).optional(),
});

export const paymentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const paymentSaleIdParamSchema = z.object({
  saleId: z.string().uuid(),
});

export const paymentRepairIdParamSchema = z.object({
  repairId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type RecordSalePaymentInput   = z.infer<typeof recordSalePaymentSchema>;
export type RecordRepairPaymentInput = z.infer<typeof recordRepairPaymentSchema>;
export type SettleRepairInput        = z.infer<typeof settleRepairSchema>;
export type ListPaymentsInput        = z.infer<typeof listPaymentsSchema>;

export type PaymentLegInput = z.infer<typeof paymentLegSchema>;
