import { Request, Response, NextFunction } from 'express';
import * as svc from './payment.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import {
  recordSalePaymentSchema,
  recordRepairPaymentSchema,
  settleRepairSchema,
  listPaymentsSchema,
  type RecordSalePaymentInput,
  type RecordRepairPaymentInput,
  type SettleRepairInput,
} from './payment.schema';
import type { AuthenticatedRequest } from '../../shared/types';

// ---------------------------------------------------------------------------
// Generic
// ---------------------------------------------------------------------------

export const listTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listPaymentsSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listTransactions(input);
    sendPaginated(res, data, { total, page, limit }, 'Payment transactions retrieved');
  } catch (err) { next(err); }
};

export const getTransactionById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const tx = await svc.getTransactionById(req.params.id as string);
    sendSuccess(res, tx, 'Payment transaction retrieved');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Sale payments
// ---------------------------------------------------------------------------

export const recordSalePayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = recordSalePaymentSchema.parse(req.body);
    const tx = await svc.recordSalePayment(input as RecordSalePaymentInput, req.user!.id);
    sendCreated(res, tx, 'Sale payment recorded');
  } catch (err) { next(err); }
};

export const getSalePaymentSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const summary = await svc.getSalePaymentSummary(req.params.saleId as string);
    sendSuccess(res, summary, 'Sale payment summary retrieved');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Repair payments
// ---------------------------------------------------------------------------

export const recordRepairPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = recordRepairPaymentSchema.parse(req.body);
    const tx = await svc.recordRepairPayment(
      req.params.repairId as string,
      input as RecordRepairPaymentInput,
      req.user!.id,
    );
    sendCreated(res, tx, 'Repair payment recorded');
  } catch (err) { next(err); }
};

export const settleRepair = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = settleRepairSchema.parse(req.body);
    const result = await svc.settleRepair(
      req.params.repairId as string,
      input as SettleRepairInput,
      req.user!.id,
    );
    sendCreated(res, result, 'Repair settled and delivered');
  } catch (err) { next(err); }
};

export const getRepairPaymentSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const summary = await svc.getRepairPaymentSummary(req.params.repairId as string);
    sendSuccess(res, summary, 'Repair payment summary retrieved');
  } catch (err) { next(err); }
};
