import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import type { AuthenticatedRequest } from '../../shared/types';
import * as service from './returns.service';
import {
  createReturnSchema,
  approveReturnSchema,
  rejectReturnSchema,
  listReturnsSchema,
  createSupplierReturnSchema,
  listSupplierReturnsSchema,
  listReturnStockSchema,
} from './returns.schema';

const pid = (req: Request) => req.params.id as string;

export const createReturn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createReturnSchema.parse(req.body);
    const data  = await service.createReturn(input, req.user!.id);
    sendCreated(res, data, 'Return request created');
  } catch (err) { next(err); }
};

export const listReturns = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input  = listReturnsSchema.parse(req.query);
    const result = await service.listReturns(input);
    sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit });
  } catch (err) { next(err); }
};

export const getReturnById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await service.getReturnById(pid(req));
    sendSuccess(res, data);
  } catch (err) { next(err); }
};

export const getReturnByNo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await service.getReturnByNo(req.params.returnNo as string);
    sendSuccess(res, data);
  } catch (err) { next(err); }
};

export const approveReturn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = approveReturnSchema.parse(req.body);
    const data  = await service.approveReturn(pid(req), input, req.user!.id);
    sendSuccess(res, data, 'Return approved');
  } catch (err) { next(err); }
};

export const rejectReturn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = rejectReturnSchema.parse(req.body);
    const data  = await service.rejectReturn(pid(req), input, req.user!.id);
    sendSuccess(res, data, 'Return rejected');
  } catch (err) { next(err); }
};

export const createSupplierReturn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createSupplierReturnSchema.parse(req.body);
    const data = await service.createSupplierReturn(input, req.user!.id);
    sendCreated(res, data, 'Returned to supplier and stock updated');
  } catch (err) { next(err); }
};

export const listSupplierReturns = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listSupplierReturnsSchema.parse(req.query);
    const result = await service.listSupplierReturns(input);
    sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit });
  } catch (err) { next(err); }
};

export const listReturnStock = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listReturnStockSchema.parse(req.query);
    const data = await service.listReturnStock(input);
    sendSuccess(res, data);
  } catch (err) { next(err); }
};
