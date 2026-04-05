import { Request, Response, NextFunction } from 'express';
import * as svc from './sales.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import {
  checkoutSchema,
  voidSaleSchema,
  listSalesSchema,
  listCustomersSchema,
  createCustomerSchema,
  type CheckoutInput,
  type VoidSaleInput,
  type CreateCustomerInput,
} from './sales.schema';
import type { AuthenticatedRequest } from '../../shared/types';

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export const checkout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = checkoutSchema.parse(req.body);
    const sale = await svc.checkout(data as CheckoutInput, req.user!.id);
    sendCreated(res, sale, 'Sale completed');
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// List & retrieve
// ---------------------------------------------------------------------------

export const listSales = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listSalesSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listSales(input);
    sendPaginated(res, data, { total, page, limit }, 'Sales retrieved');
  } catch (err) {
    next(err);
  }
};

export const getSale = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const sale = await svc.getSaleById(req.params.id as string);
    sendSuccess(res, sale, 'Sale retrieved');
  } catch (err) {
    next(err);
  }
};

export const getByReceiptNo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const sale = await svc.getSaleByReceiptNo(req.params.receiptNo as string);
    sendSuccess(res, sale, 'Sale retrieved');
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------

export const voidSale = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = voidSaleSchema.parse(req.body);
    await svc.voidSale(req.params.id as string, input as VoidSaleInput, req.user!.id);
    sendSuccess(res, null, 'Sale voided and stock restored');
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const createCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = createCustomerSchema.parse(req.body);
    const customer = await svc.createCustomer(data as CreateCustomerInput);
    sendCreated(res, customer, 'Customer created');
  } catch (err) {
    next(err);
  }
};

export const listCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listCustomersSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listCustomers(input);
    sendPaginated(res, data, { total, page, limit }, 'Customers retrieved');
  } catch (err) {
    next(err);
  }
};
