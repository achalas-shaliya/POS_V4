import { prisma } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { SaleStatus, PaymentEntityType } from '../../generated/prisma/enums';
import type { CreateCustomerInput, ListSalesInput } from './sales.schema';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Include shapes (reused across queries)
// ---------------------------------------------------------------------------

const PAYMENT_INCLUDE = {
  include: { legs: true },
  orderBy: { createdAt: 'asc' as const },
};

const SALE_SUMMARY_INCLUDE = {
  outlet: { select: { id: true, name: true } },
  cashier: { select: { id: true, fullName: true } },
  customer: { select: { id: true, name: true, phone: true } },
  payments: PAYMENT_INCLUDE,
  _count: { select: { items: true } },
} satisfies Prisma.SaleInclude;

const SALE_DETAIL_INCLUDE = {
  outlet: { select: { id: true, name: true } },
  cashier: { select: { id: true, fullName: true } },
  customer: { select: { id: true, name: true, phone: true } },
  voidedBy: { select: { id: true, fullName: true } },
  payments: PAYMENT_INCLUDE,
  items: {
    include: {
      item: { select: { id: true, sku: true, name: true } },
    },
  },
} satisfies Prisma.SaleInclude;

// ---------------------------------------------------------------------------
// Sale reads
// ---------------------------------------------------------------------------

export const findSaleById = (id: string) =>
  prisma.sale.findUnique({ where: { id }, include: SALE_DETAIL_INCLUDE });

export const findSaleByReceiptNo = (receiptNo: string) =>
  prisma.sale.findUnique({ where: { receiptNo }, include: SALE_DETAIL_INCLUDE });

export const listSales = (
  skip: number,
  take: number,
  filters: Omit<ListSalesInput, 'page' | 'limit' | 'sortBy' | 'sortOrder' | 'search'>,
) => {
  const where: Prisma.SaleWhereInput = {
    ...(filters.outletId && { outletId: filters.outletId }),
    ...(filters.cashierId && { cashierId: filters.cashierId }),
    ...(filters.customerId && { customerId: filters.customerId }),
    ...(filters.status && { status: filters.status as SaleStatus }),
    ...((filters.fromDate || filters.toDate) && {
      createdAt: {
        ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
        ...(filters.toDate && { lte: new Date(filters.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.sale.findMany({
      where,
      skip,
      take,
      include: SALE_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Sale writes (inside transactions)
// ---------------------------------------------------------------------------

export const createSaleInTx = (
  tx: Tx,
  data: {
    receiptNo: string;
    outletId: string;
    cashierId: string;
    customerId?: string;
    note?: string;
    subtotal: number;
    discountAmt: number;
    total: number;
    items: {
      itemId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      subtotal: number;
    }[];
    payment: {
      txNo: string;
      totalAmount: number;
      totalChange: number;
      legs: {
        method: 'CASH' | 'CARD';
        amount: number;
        change: number;
        reference?: string;
      }[];
    };
  },
) =>
  tx.sale.create({
    data: {
      receiptNo: data.receiptNo,
      outletId: data.outletId,
      cashierId: data.cashierId,
      customerId: data.customerId,
      note: data.note,
      subtotal: data.subtotal,
      discountAmt: data.discountAmt,
      total: data.total,
      items: { create: data.items },
      payments: {
        create: {
          txNo: data.payment.txNo,
          entityType: PaymentEntityType.SALE,
          totalAmount: data.payment.totalAmount,
          totalChange: data.payment.totalChange,
          createdById: data.cashierId,
          legs: { create: data.payment.legs },
        },
      },
    },
    include: SALE_DETAIL_INCLUDE,
  });

export const voidSaleInTx = (
  tx: Tx,
  id: string,
  voidedById: string,
  voidReason: string,
) =>
  tx.sale.update({
    where: { id },
    data: {
      status: SaleStatus.VOIDED,
      voidedAt: new Date(),
      voidReason,
      voidedById,
    },
  });

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const findCustomerById = (id: string) =>
  prisma.customer.findUnique({ where: { id } });

export const findCustomerByPhone = (phone: string) =>
  prisma.customer.findUnique({ where: { phone } });

export const createCustomer = (data: CreateCustomerInput) =>
  prisma.customer.create({ data });

export const listCustomers = (skip: number, take: number, search?: string) => {
  const where: Prisma.CustomerWhereInput = search
    ? {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
        ],
      }
    : {};

  return prisma.$transaction([
    prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.customer.count({ where }),
  ]);
};
