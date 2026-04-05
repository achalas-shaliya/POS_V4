import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Valid status transitions map
// ---------------------------------------------------------------------------
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING:     ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'CANCELLED'],
  DONE:        ['DELIVERED'],
  DELIVERED:   [],
  CANCELLED:   [],
};

// ---------------------------------------------------------------------------
// Create repair job
// ---------------------------------------------------------------------------
export const createRepairJobSchema = z.object({
  outletId:      z.string().uuid(),
  customerId:    z.string().uuid(),
  technicianId:  z.string().uuid().optional(),
  deviceBrand:   z.string().min(1).max(80),
  deviceModel:   z.string().min(1).max(80),
  deviceColor:   z.string().max(40).optional(),
  serialNo:      z.string().max(100).optional(),
  condition:     z.string().max(255).optional(),
  problemDesc:   z.string().min(1).max(2000),
  internalNote:  z.string().max(500).optional(),
  laborCost:     z.number().nonnegative().default(0),
  estimatedDone: z.string().datetime({ offset: true }).optional(),
  // Optional advance payment at intake
  advance: z
    .object({
      amount:    z.number().positive(),
      method:    z.enum(['CASH', 'CARD']),
      reference: z.string().max(100).optional(),
      note:      z.string().max(255).optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Update editable fields (not status — that uses its own endpoint)
// ---------------------------------------------------------------------------
export const updateRepairJobSchema = z.object({
  technicianId:  z.string().uuid().optional(),
  deviceBrand:   z.string().min(1).max(80).optional(),
  deviceModel:   z.string().min(1).max(80).optional(),
  deviceColor:   z.string().max(40).optional(),
  serialNo:      z.string().max(100).optional(),
  condition:     z.string().max(255).optional(),
  problemDesc:   z.string().min(1).max(2000).optional(),
  diagnosis:     z.string().max(2000).optional(),
  internalNote:  z.string().max(500).optional(),
  laborCost:     z.number().nonnegative().optional(),
  estimatedDone: z.string().datetime({ offset: true }).optional(),
});

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------
export const updateStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DONE', 'DELIVERED', 'CANCELLED']),
  note:   z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Add part(s) to a repair job
// ---------------------------------------------------------------------------
export const addPartSchema = z.object({
  itemId:   z.string().uuid(),
  quantity: z.number().int().positive(),
  // Override cost price (defaults to item.costPrice)
  unitCost: z.number().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// Add advance payment
// ---------------------------------------------------------------------------
export const addAdvanceSchema = z.object({
  amount:    z.number().positive(),
  method:    z.enum(['CASH', 'CARD']),
  reference: z.string().max(100).optional(),
  note:      z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// List / filter
// ---------------------------------------------------------------------------
export const listRepairJobsSchema = paginationSchema.extend({
  outletId:     z.string().uuid().optional(),
  customerId:   z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
  status:       z
    .enum(['PENDING', 'IN_PROGRESS', 'DONE', 'DELIVERED', 'CANCELLED'])
    .optional(),
  fromDate:     z.string().datetime({ offset: true }).optional(),
  toDate:       z.string().datetime({ offset: true }).optional(),
});

export const repairIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const repairPartParamSchema = z.object({
  id: z.string().uuid(),
  partId: z.string().uuid(),
});

export const repairJobNoParamSchema = z.object({
  jobNo: z.string().min(1).max(100),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type CreateRepairJobInput = z.infer<typeof createRepairJobSchema>;
export type UpdateRepairJobInput = z.infer<typeof updateRepairJobSchema>;
export type UpdateRepairStatusInput = z.infer<typeof updateStatusSchema>;
export type AddPartInput = z.infer<typeof addPartSchema>;
export type AddAdvanceInput = z.infer<typeof addAdvanceSchema>;
export type ListRepairJobsInput = z.infer<typeof listRepairJobsSchema>;
