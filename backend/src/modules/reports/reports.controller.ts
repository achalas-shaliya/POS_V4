import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '../../shared/utils/response';
import * as service from './reports.service';
import {
  salesSummarySchema,
  salesByPeriodSchema,
  topItemsSchema,
  repairSummarySchema,
  repairTurnaroundSchema,
  inventorySnapshotSchema,
  inventoryMovementsSchema,
  cashSummarySchema,
  cashVarianceSchema,
} from './reports.schema';

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export const salesSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = salesSummarySchema.parse(req.query);
    const data  = await service.getSalesSummary(input);
    sendSuccess(res, data, 'Sales summary');
  } catch (err) { next(err); }
};

export const salesByPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = salesByPeriodSchema.parse(req.query);
    const data  = await service.getSalesByPeriod(input);
    sendSuccess(res, data, 'Sales by period');
  } catch (err) { next(err); }
};

export const topItems = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = topItemsSchema.parse(req.query);
    const data  = await service.getTopSellingItems(input);
    sendSuccess(res, data, 'Top selling items');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Repairs
// ---------------------------------------------------------------------------

export const repairSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = repairSummarySchema.parse(req.query);
    const data  = await service.getRepairSummary(input);
    sendSuccess(res, data, 'Repair summary');
  } catch (err) { next(err); }
};

export const repairTurnaround = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = repairTurnaroundSchema.parse(req.query);
    const data  = await service.getRepairTurnaround(input);
    sendSuccess(res, data, 'Repair turnaround');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const inventorySnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = inventorySnapshotSchema.parse(req.query);
    const data  = await service.getInventorySnapshot(input);
    sendSuccess(res, data, 'Inventory snapshot');
  } catch (err) { next(err); }
};

export const inventoryMovements = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input  = inventoryMovementsSchema.parse(req.query);
    const result = await service.getInventoryMovements(input);
    sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit }, 'Inventory movements');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Cash
// ---------------------------------------------------------------------------

export const cashSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = cashSummarySchema.parse(req.query);
    const data  = await service.getCashSummary(input);
    sendSuccess(res, data, 'Cash register summary');
  } catch (err) { next(err); }
};

export const cashVariance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input  = cashVarianceSchema.parse(req.query);
    const result = await service.getCashVariance(input);
    sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit }, 'Cash variance');
  } catch (err) { next(err); }
};
