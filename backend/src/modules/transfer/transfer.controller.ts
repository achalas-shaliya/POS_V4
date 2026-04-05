import { Request, Response, NextFunction } from 'express';
import * as svc from './transfer.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import {
  createTransferSchema,
  dispatchTransferSchema,
  receiveTransferSchema,
  cancelTransferSchema,
  listTransfersSchema,
  type CreateTransferInput,
  type DispatchTransferInput,
  type ReceiveTransferInput,
  type CancelTransferInput,
} from './transfer.schema';
import type { AuthenticatedRequest } from '../../shared/types';

const id = (req: Request) => req.params.id as string;

export const createTransfer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createTransferSchema.parse(req.body);
    const transfer = await svc.createTransfer(input as CreateTransferInput, req.user!.id);
    sendCreated(res, transfer, 'Transfer request created');
  } catch (err) { next(err); }
};

export const listTransfers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listTransfersSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listTransfers(input);
    sendPaginated(res, data, { total, page, limit }, 'Transfers retrieved');
  } catch (err) { next(err); }
};

export const getTransferById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const transfer = await svc.getTransferById(id(req));
    sendSuccess(res, transfer, 'Transfer retrieved');
  } catch (err) { next(err); }
};

export const getTransferByNo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const transfer = await svc.getTransferByNo(req.params.transferNo as string);
    sendSuccess(res, transfer, 'Transfer retrieved');
  } catch (err) { next(err); }
};

export const dispatchTransfer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = dispatchTransferSchema.parse(req.body);
    const transfer = await svc.dispatchTransfer(id(req), input as DispatchTransferInput, req.user!.id);
    sendSuccess(res, transfer, 'Transfer dispatched');
  } catch (err) { next(err); }
};

export const receiveTransfer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = receiveTransferSchema.parse(req.body);
    const transfer = await svc.receiveTransfer(id(req), input as ReceiveTransferInput, req.user!.id);
    sendSuccess(res, transfer, 'Transfer received');
  } catch (err) { next(err); }
};

export const cancelTransfer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = cancelTransferSchema.parse(req.body);
    const transfer = await svc.cancelTransfer(id(req), input as CancelTransferInput, req.user!.id);
    sendSuccess(res, transfer, 'Transfer cancelled');
  } catch (err) { next(err); }
};
