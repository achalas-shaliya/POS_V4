import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(1).max(20),
  email: z.string().email().optional(),
});

export const listCustomersSchema = paginationSchema.extend({
  search: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Checkout (the core POS action)
// ---------------------------------------------------------------------------
export const lineItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  // Override the item's catalogue price (for manager-approved discounts)
  unitPrice: z.number().nonnegative().optional(),
  // Per-unit discount amount (default: 0)
  discount: z.number().nonnegative().default(0),
});

export const paymentInputSchema = z.object({
  method: z.enum(['CASH', 'CARD']),
  // Amount tendered for this payment leg
  amount: z.number().positive(),
  // Card terminal reference / transaction ID
  reference: z.string().max(100).optional(),
});

export const checkoutSchema = z
  .object({
    outletId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    note: z.string().max(500).optional(),
    // Sale-level discount applied after line subtotals are summed
    discountAmt: z.number().nonnegative().default(0),
    items: z.array(lineItemSchema).min(1, 'Cart must have at least one item'),
    payments: z
      .array(paymentInputSchema)
      .min(1, 'At least one payment method is required'),
  })
  .refine(
    (d) => {
      // No duplicate itemIds in a single cart
      const ids = d.items.map((i) => i.itemId);
      return new Set(ids).size === ids.length;
    },
    { message: 'Duplicate items in cart — merge quantities instead', path: ['items'] },
  );

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------
export const voidSaleSchema = z.object({
  reason: z.string().min(1).max(255),
});

export const saleIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const receiptNoParamSchema = z.object({
  receiptNo: z.string().min(1).max(100),
});

// ---------------------------------------------------------------------------
// List / filter
// ---------------------------------------------------------------------------
export const listSalesSchema = paginationSchema.extend({
  outletId: z.string().uuid().optional(),
  cashierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['COMPLETED', 'VOIDED']).optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate: z.string().datetime({ offset: true }).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type ListSalesInput = z.infer<typeof listSalesSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
