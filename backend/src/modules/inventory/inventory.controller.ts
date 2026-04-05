import { Request, Response, NextFunction } from 'express';
import * as svc from './inventory.service';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
} from '../../shared/utils/response';
import {
  listItemsSchema,
  stockFilterSchema,
  listMovementsSchema,
  type CreateItemInput,
  type UpdateItemInput,
  type CreateCategoryInput,
  type CreateBrandInput,
  type CreateWarehouseInput,
  type CreateOutletInput,
  type PurchaseStockInput,
  type TransferStockInput,
  type AdjustStockInput,
  type SetMinStockInput,
} from './inventory.schema';
import type { AuthenticatedRequest } from '../../shared/types';

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const createItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await svc.createItem(req.body as CreateItemInput);
    sendCreated(res, item, 'Item created');
  } catch (err) { next(err); }
};

export const listItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = listItemsSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listItems(input);
    sendPaginated(res, data, { total, page, limit }, 'Items retrieved');
  } catch (err) { next(err); }
};

export const getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await svc.getItemById(req.params.id as string);
    sendSuccess(res, item, 'Item retrieved');
  } catch (err) { next(err); }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const item = await svc.updateItem(req.params.id as string, req.body as UpdateItemInput);
    sendSuccess(res, item, 'Item updated');
  } catch (err) { next(err); }
};

export const deactivateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await svc.deactivateItem(req.params.id as string);
    sendSuccess(res, null, 'Item deactivated');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const listCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await svc.listCategories();
    sendSuccess(res, data, 'Categories retrieved');
  } catch (err) { next(err); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cat = await svc.createCategory(req.body as CreateCategoryInput);
    sendCreated(res, cat, 'Category created');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const listBrands = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await svc.listBrands();
    sendSuccess(res, data, 'Brands retrieved');
  } catch (err) { next(err); }
};

export const createBrand = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brand = await svc.createBrand(req.body as CreateBrandInput);
    sendCreated(res, brand, 'Brand created');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export const listWarehouses = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await svc.listWarehouses();
    sendSuccess(res, data, 'Warehouses retrieved');
  } catch (err) { next(err); }
};

export const createWarehouse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const wh = await svc.createWarehouse(req.body as CreateWarehouseInput);
    sendCreated(res, wh, 'Warehouse created');
  } catch (err) { next(err); }
};

export const getWarehouseStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = stockFilterSchema.parse(req.query);
    const { data, total, page, limit } = await svc.getWarehouseStock(req.params.id as string, input);
    sendPaginated(res, data, { total, page, limit }, 'Warehouse stock retrieved');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------

export const listOutlets = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await svc.listOutlets();
    sendSuccess(res, data, 'Outlets retrieved');
  } catch (err) { next(err); }
};

export const createOutlet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const outlet = await svc.createOutlet(req.body as CreateOutletInput);
    sendCreated(res, outlet, 'Outlet created');
  } catch (err) { next(err); }
};

export const getOutletStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = stockFilterSchema.parse(req.query);
    const { data, total, page, limit } = await svc.getOutletStock(req.params.id as string, input);
    sendPaginated(res, data, { total, page, limit }, 'Outlet stock retrieved');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Stock operations
// ---------------------------------------------------------------------------

export const purchaseStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await svc.purchaseStock(req.body as PurchaseStockInput, req.user!.id);
    sendSuccess(res, null, 'Stock received successfully');
  } catch (err) { next(err); }
};

export const transferStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await svc.transferStock(req.body as TransferStockInput, req.user!.id);
    sendSuccess(res, null, 'Stock transferred successfully');
  } catch (err) { next(err); }
};

export const adjustStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await svc.adjustStock(req.body as AdjustStockInput, req.user!.id);
    sendSuccess(res, null, 'Stock adjusted successfully');
  } catch (err) { next(err); }
};

export const setMinStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await svc.setMinStock(req.body as SetMinStockInput);
    sendSuccess(res, null, 'Minimum stock level updated');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------

export const listMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = listMovementsSchema.parse(req.query);
    const { data, total, page, limit } = await svc.listMovements(input);
    sendPaginated(res, data, { total, page, limit }, 'Movements retrieved');
  } catch (err) { next(err); }
};
