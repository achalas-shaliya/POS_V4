import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Shared: one line item in a transfer request
// ---------------------------------------------------------------------------
const transferItemSchema = z.object({
  itemId:   z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

// ---------------------------------------------------------------------------
// Create transfer request
// ---------------------------------------------------------------------------
export const createTransferSchema = z.object({
  fromType: z.enum(['OUTLET', 'WAREHOUSE']),
  fromId:   z.string().uuid(),
  toType:   z.enum(['OUTLET', 'WAREHOUSE']),
  toId:     z.string().uuid(),
  items:    z.array(transferItemSchema).min(1, 'At least one item is required'),
  note:     z.string().max(500).optional(),
}).refine(
  (d) => !(d.fromType === d.toType && d.fromId === d.toId),
  { message: 'Source and destination must be different' },
);

// ---------------------------------------------------------------------------
// Dispatch — confirm stock is leaving the source
// ---------------------------------------------------------------------------
export const dispatchTransferSchema = z.object({
  note: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Receive — confirm stock arrived; optionally record partial received quantities
// ---------------------------------------------------------------------------
const receivedItemSchema = z.object({
  transferItemId: z.string().uuid(),
  receivedQty:    z.number().int().min(0),
});

export const receiveTransferSchema = z.object({
  items: z.array(receivedItemSchema).min(1, 'At least one item confirmation required'),
  note:  z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------
export const cancelTransferSchema = z.object({
  note: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
export const listTransfersSchema = paginationSchema.extend({
  status:   z.enum(['PENDING', 'DISPATCHED', 'RECEIVED', 'CANCELLED']).optional(),
  fromId:   z.string().uuid().optional(),
  toId:     z.string().uuid().optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate:   z.string().datetime({ offset: true }).optional(),
});

export const transferIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const transferNoParamSchema = z.object({
  transferNo: z.string().min(1).max(100),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CreateTransferInput   = z.infer<typeof createTransferSchema>;
export type DispatchTransferInput = z.infer<typeof dispatchTransferSchema>;
export type ReceiveTransferInput  = z.infer<typeof receiveTransferSchema>;
export type CancelTransferInput   = z.infer<typeof cancelTransferSchema>;
export type ListTransfersInput    = z.infer<typeof listTransfersSchema>;
