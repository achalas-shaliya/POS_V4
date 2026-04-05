import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Open register
// ---------------------------------------------------------------------------
export const openRegisterSchema = z.object({
  outletId:       z.string().uuid(),
  openingBalance: z.number().min(0, 'Opening balance must be zero or positive'),
  note:           z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Manual cash in / cash out
// ---------------------------------------------------------------------------
export const cashInOutSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  note:   z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Close register — cashier submits the physically counted amount
// ---------------------------------------------------------------------------
export const closeRegisterSchema = z.object({
  actualCash:  z.number().min(0, 'Actual cash must be zero or positive'),
  closingNote: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// List registers (manager view)
// ---------------------------------------------------------------------------
export const listRegistersSchema = paginationSchema.extend({
  outletId: z.string().uuid().optional(),
  userId:   z.string().uuid().optional(),
  status:   z.enum(['OPEN', 'CLOSED']).optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate:   z.string().datetime({ offset: true }).optional(),
});

// ---------------------------------------------------------------------------
// List movements within a register
// ---------------------------------------------------------------------------
export const listMovementsSchema = paginationSchema.extend({
  type: z
    .enum(['SALE_CASH', 'REPAIR_CASH', 'CASH_IN', 'CASH_OUT', 'OPENING_FLOAT'])
    .optional(),
});

export const cashRegisterIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type OpenRegisterInput   = z.infer<typeof openRegisterSchema>;
export type CashInOutInput      = z.infer<typeof cashInOutSchema>;
export type CloseRegisterInput  = z.infer<typeof closeRegisterSchema>;
export type ListRegistersInput  = z.infer<typeof listRegistersSchema>;
export type ListMovementsInput  = z.infer<typeof listMovementsSchema>;
