import { Request, Response, NextFunction } from 'express';
import * as svc from './cash.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import {
  openRegisterSchema,
  cashInOutSchema,
  closeRegisterSchema,
  listRegistersSchema,
  listMovementsSchema,
  type OpenRegisterInput,
  type CashInOutInput,
  type CloseRegisterInput,
} from './cash.schema';
import type { AuthenticatedRequest } from '../../shared/types';

const id = (req: Request) => req.params.id as string;

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

export const openRegister = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = openRegisterSchema.parse(req.body);
    const register = await svc.openRegister(input as OpenRegisterInput, req.user!.id);
    sendCreated(res, register, 'Register opened');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// My open register
// ---------------------------------------------------------------------------

export const getMyOpenRegister = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const register = await svc.getMyOpenRegister(req.user!.id);
    sendSuccess(res, register, 'Open register retrieved');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Cash In / Cash Out
// ---------------------------------------------------------------------------

export const cashIn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = cashInOutSchema.parse(req.body);
    const movement = await svc.cashIn(id(req), input as CashInOutInput, req.user!.id);
    sendCreated(res, movement, 'Cash in recorded');
  } catch (err) { next(err); }
};

export const cashOut = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = cashInOutSchema.parse(req.body);
    const movement = await svc.cashOut(id(req), input as CashInOutInput, req.user!.id);
    sendCreated(res, movement, 'Cash out recorded');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

export const closeRegister = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = closeRegisterSchema.parse(req.body);
    const register = await svc.closeRegister(id(req), input as CloseRegisterInput, req.user!.id);
    sendSuccess(res, register, 'Register closed');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const listRegisters = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listRegistersSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listRegisters(input);
    sendPaginated(res, data, { total, page, limit }, 'Registers retrieved');
  } catch (err) { next(err); }
};

export const getRegisterById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const register = await svc.getRegisterById(id(req));
    sendSuccess(res, register, 'Register retrieved');
  } catch (err) { next(err); }
};

export const getRegisterBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const balance = await svc.getRegisterBalance(id(req));
    sendSuccess(res, balance, 'Register balance retrieved');
  } catch (err) { next(err); }
};

export const listMovements = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listMovementsSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listMovements(id(req), input);
    sendPaginated(res, data, { total, page, limit }, 'Cash movements retrieved');
  } catch (err) { next(err); }
};
