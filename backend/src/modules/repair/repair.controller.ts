import { Request, Response, NextFunction } from 'express';
import * as svc from './repair.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response';
import {
  createRepairJobSchema,
  updateRepairJobSchema,
  updateStatusSchema,
  addPartSchema,
  addAdvanceSchema,
  listRepairJobsSchema,
  updatePartDiscountSchema,
  type CreateRepairJobInput,
  type UpdateRepairJobInput,
  type UpdateRepairStatusInput,
  type AddPartInput,
  type AddAdvanceInput,
  type UpdatePartDiscountInput,
} from './repair.schema';
import {
  updatePartQuantitySchema,
  updatePartUsedSchema,
  type UpdatePartQuantityInput,
  type UpdatePartUsedInput,
} from './repair.schema';
import type { AuthenticatedRequest } from '../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const id = (req: Request) => req.params.id as string;

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const createJob = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = createRepairJobSchema.parse(req.body);
    const job = await svc.createRepairJob(data as CreateRepairJobInput, req.user!.id);
    sendCreated(res, job, 'Repair job created');
  } catch (err) { next(err); }
};

export const listJobs = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = listRepairJobsSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listJobs(input);
    sendPaginated(res, data, { total, page, limit }, 'Repair jobs retrieved');
  } catch (err) { next(err); }
};

export const getJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const job = await svc.getJobById(id(req));
    sendSuccess(res, job, 'Repair job retrieved');
  } catch (err) { next(err); }
};

export const getJobByNo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const job = await svc.getJobByNo(req.params.jobNo as string);
    sendSuccess(res, job, 'Repair job retrieved');
  } catch (err) { next(err); }
};

export const updateJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = updateRepairJobSchema.parse(req.body);
    const job = await svc.updateRepairJob(id(req), data as UpdateRepairJobInput);
    sendSuccess(res, job, 'Repair job updated');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const updateStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateStatusSchema.parse(req.body);
    const job = await svc.updateStatus(id(req), input as UpdateRepairStatusInput, req.user!.id);
    sendSuccess(res, job, 'Repair status updated');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export const addPart = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = addPartSchema.parse(req.body);
    const part = await svc.addPart(id(req), input as AddPartInput, req.user!.id);
    sendCreated(res, part, 'Part added to repair job');
  } catch (err) { next(err); }
};

export const removePart = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await svc.removePart(req.params.partId as string, req.user!.id);
    sendSuccess(res, null, 'Part removed and stock restored');
  } catch (err) { next(err); }
};

export const updatePartDiscount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updatePartDiscountSchema.parse(req.body);
    const job = await svc.updatePartDiscount(req.params.partId as string, input as UpdatePartDiscountInput, req.params.id as string);
    sendSuccess(res, job, 'Part discount updated');
  } catch (err) { next(err); }
};

export const updatePartQuantity = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updatePartQuantitySchema.parse(req.body);
    const job = await svc.updatePartQuantity(req.params.partId as string, input as UpdatePartQuantityInput, req.params.id as string);
    sendSuccess(res, job, 'Part quantity updated');
  } catch (err) { next(err); }
};

export const updatePartUsed = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updatePartUsedSchema.parse(req.body);
    const job = await svc.updatePartUsed(req.params.partId as string, input as UpdatePartUsedInput, req.params.id as string);
    sendSuccess(res, job, 'Part used status updated');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Advances
// ---------------------------------------------------------------------------

export const addAdvance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = addAdvanceSchema.parse(req.body);
    const job = await svc.addAdvance(id(req), input as AddAdvanceInput, req.user!.id);
    sendCreated(res, job, 'Advance payment recorded');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export const getBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const balance = await svc.getBalance(id(req));
    sendSuccess(res, balance, 'Balance calculated');
  } catch (err) { next(err); }
};
