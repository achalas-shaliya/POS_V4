import { prisma } from '../../config/database';
import { AppError, notFound, conflict } from '../../shared/middleware/errorHandler';
import { LocationType, MovementType } from '../../generated/prisma/enums';
import * as repo from './inventory.repository';
import type {
  CreateItemInput,
  UpdateItemInput,
  ListItemsInput,
  CreateCategoryInput,
  CreateBrandInput,
  CreateWarehouseInput,
  CreateOutletInput,
  PurchaseStockInput,
  TransferStockInput,
  AdjustStockInput,
  SetMinStockInput,
  ListMovementsInput,
  StockFilterInput,
} from './inventory.schema';
import { getPaginationArgs } from '../../shared/utils/pagination';

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const createItem = async (data: CreateItemInput) => {
  const existing = await repo.findItemBySku(data.sku);
  if (existing) throw conflict(`SKU "${data.sku}" is already in use`);

  const [category, brand] = await Promise.all([
    repo.findCategoryById(data.categoryId),
    data.brandId ? repo.findBrandById(data.brandId) : Promise.resolve(null),
  ]);
  if (!category) throw notFound('Category');
  if (data.brandId && !brand) throw notFound('Brand');

  return repo.createItem(data);
};

export const updateItem = async (id: string, data: UpdateItemInput) => {
  const item = await repo.findItemById(id);
  if (!item) throw notFound('Item');

  if (data.sku && data.sku !== item.sku) {
    const skuTaken = await repo.findItemBySku(data.sku);
    if (skuTaken) throw conflict(`SKU "${data.sku}" is already in use`);
  }
  if (data.categoryId) {
    const cat = await repo.findCategoryById(data.categoryId);
    if (!cat) throw notFound('Category');
  }
  if (data.brandId) {
    const brand = await repo.findBrandById(data.brandId);
    if (!brand) throw notFound('Brand');
  }

  return repo.updateItem(id, data);
};

export const getItemById = async (id: string) => {
  const item = await repo.findItemById(id);
  if (!item) throw notFound('Item');
  return item;
};

export const listItems = async (input: ListItemsInput) => {
  const { skip, take, search } = getPaginationArgs(input);
  const [data, total] = await repo.listItems(skip, take, {
    search,
    type: input.type,
    categoryId: input.categoryId,
    brandId: input.brandId,
    isActive: input.isActive,
  });
  return { data, total, page: input.page, limit: input.limit };
};

export const deactivateItem = async (id: string) => {
  const item = await repo.findItemById(id);
  if (!item) throw notFound('Item');
  return repo.deactivateItem(id);
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const listCategories = () => repo.findAllCategories();

export const createCategory = async (data: CreateCategoryInput) => {
  const existing = await repo.findCategoryByName(data.name);
  if (existing) throw conflict(`Category "${data.name}" already exists`);

  if (data.parentId) {
    const parent = await repo.findCategoryById(data.parentId);
    if (!parent) throw notFound('Parent category');
  }

  return repo.createCategory(data);
};

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const listBrands = () => repo.findAllBrands();

export const createBrand = async (data: CreateBrandInput) => {
  const existing = await repo.findBrandByName(data.name);
  if (existing) throw conflict(`Brand "${data.name}" already exists`);
  return repo.createBrand(data);
};

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export const listWarehouses = () => repo.findAllWarehouses();

export const createWarehouse = async (data: CreateWarehouseInput) => {
  const existing = await repo.findAllWarehouses().then((wh) =>
    wh.find((w) => w.name.toLowerCase() === data.name.toLowerCase()),
  );
  if (existing) throw conflict(`Warehouse "${data.name}" already exists`);
  return repo.createWarehouse(data);
};

export const getWarehouseStock = async (warehouseId: string, input: StockFilterInput) => {
  const wh = await repo.findWarehouseById(warehouseId);
  if (!wh) throw notFound('Warehouse');

  const { skip, take, search } = getPaginationArgs(input);
  const [data, total] = await repo.getWarehouseStock(warehouseId, skip, take, {
    search,
    lowStockOnly: input.lowStockOnly,
  });
  return { data, total, page: input.page, limit: input.limit };
};

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------

export const listOutlets = () => repo.findAllOutlets();

export const createOutlet = async (data: CreateOutletInput) => {
  const existing = await repo.findAllOutlets().then((ots) =>
    ots.find((o) => o.name.toLowerCase() === data.name.toLowerCase()),
  );
  if (existing) throw conflict(`Outlet "${data.name}" already exists`);
  return repo.createOutlet(data);
};

export const getOutletStock = async (outletId: string, input: StockFilterInput) => {
  const outlet = await repo.findOutletById(outletId);
  if (!outlet) throw notFound('Outlet');

  const { skip, take, search } = getPaginationArgs(input);
  const [data, total] = await repo.getOutletStock(outletId, skip, take, {
    search,
    lowStockOnly: input.lowStockOnly,
  });
  return { data, total, page: input.page, limit: input.limit };
};

// ---------------------------------------------------------------------------
// Stock: Purchase — receive stock from supplier into a warehouse
// ---------------------------------------------------------------------------

export const purchaseStock = async (data: PurchaseStockInput, userId: string) => {
  const [warehouse, item] = await Promise.all([
    repo.findWarehouseById(data.warehouseId),
    repo.findItemById(data.itemId),
  ]);
  if (!warehouse) throw notFound('Warehouse');
  if (!item) throw notFound('Item');
  if (!item.isActive) throw new AppError('Item is inactive', 400);

  await prisma.$transaction(async (tx) => {
    await repo.upsertWarehouseStock(tx, data.warehouseId, data.itemId, data.quantity);
    await repo.createMovement(tx, {
      movementType: MovementType.PURCHASE,
      quantity: data.quantity,
      note: data.note,
      itemId: data.itemId,
      toType: LocationType.WAREHOUSE,
      toId: data.warehouseId,
      createdBy: userId,
    });
  });
};

// ---------------------------------------------------------------------------
// Stock: Transfer — move stock between any two locations atomically
// ---------------------------------------------------------------------------

export const transferStock = async (data: TransferStockInput, userId: string) => {
  // Validate both locations and the item
  const [fromLocation, toLocation, item] = await Promise.all([
    data.fromType === 'WAREHOUSE'
      ? repo.findWarehouseById(data.fromId)
      : repo.findOutletById(data.fromId),
    data.toType === 'WAREHOUSE'
      ? repo.findWarehouseById(data.toId)
      : repo.findOutletById(data.toId),
    repo.findItemById(data.itemId),
  ]);

  if (!fromLocation) throw notFound(`Source ${data.fromType.toLowerCase()}`);
  if (!toLocation) throw notFound(`Destination ${data.toType.toLowerCase()}`);
  if (!item) throw notFound('Item');
  if (!item.isActive) throw new AppError('Item is inactive', 400);

  await prisma.$transaction(async (tx) => {
    // Read and validate source stock within the transaction
    const sourceStock =
      data.fromType === 'WAREHOUSE'
        ? await repo.getWarehouseStockInTx(tx, data.fromId, data.itemId)
        : await repo.getOutletStockInTx(tx, data.fromId, data.itemId);

    if (!sourceStock || sourceStock.quantity < data.quantity) {
      throw new AppError(
        `Insufficient stock at source location (available: ${sourceStock?.quantity ?? 0})`,
        400,
      );
    }

    // Decrement source
    if (data.fromType === 'WAREHOUSE') {
      await repo.upsertWarehouseStock(tx, data.fromId, data.itemId, -data.quantity);
    } else {
      await repo.upsertOutletStock(tx, data.fromId, data.itemId, -data.quantity);
    }

    // Increment destination
    if (data.toType === 'WAREHOUSE') {
      await repo.upsertWarehouseStock(tx, data.toId, data.itemId, data.quantity);
    } else {
      await repo.upsertOutletStock(tx, data.toId, data.itemId, data.quantity);
    }

    await repo.createMovement(tx, {
      movementType: MovementType.TRANSFER,
      quantity: data.quantity,
      note: data.note,
      itemId: data.itemId,
      fromType: data.fromType as LocationType,
      fromId: data.fromId,
      toType: data.toType as LocationType,
      toId: data.toId,
      createdBy: userId,
    });
  });
};

// ---------------------------------------------------------------------------
// Stock: Adjustment — set an absolute quantity and record the delta
// ---------------------------------------------------------------------------

export const adjustStock = async (data: AdjustStockInput, userId: string) => {
  const [location, item] = await Promise.all([
    data.locationType === 'WAREHOUSE'
      ? repo.findWarehouseById(data.locationId)
      : repo.findOutletById(data.locationId),
    repo.findItemById(data.itemId),
  ]);

  if (!location) throw notFound(data.locationType.charAt(0) + data.locationType.slice(1).toLowerCase());
  if (!item) throw notFound('Item');

  await prisma.$transaction(async (tx) => {
    // Get current stock within tx
    const current =
      data.locationType === 'WAREHOUSE'
        ? await repo.getWarehouseStockInTx(tx, data.locationId, data.itemId)
        : await repo.getOutletStockInTx(tx, data.locationId, data.itemId);

    const currentQty = current?.quantity ?? 0;
    const diff = data.newQuantity - currentQty;

    // Set new quantity
    if (data.locationType === 'WAREHOUSE') {
      await repo.setWarehouseStock(tx, data.locationId, data.itemId, data.newQuantity);
    } else {
      await repo.setOutletStock(tx, data.locationId, data.itemId, data.newQuantity);
    }

    await repo.createMovement(tx, {
      movementType: MovementType.ADJUSTMENT,
      // Record the absolute magnitude; the note captures direction
      quantity: Math.abs(diff) || 0,
      note: data.note ?? `Adjusted from ${currentQty} → ${data.newQuantity} (${diff >= 0 ? '+' : ''}${diff})`,
      itemId: data.itemId,
      fromType: diff < 0 ? (data.locationType as LocationType) : undefined,
      fromId: diff < 0 ? data.locationId : undefined,
      toType: diff > 0 ? (data.locationType as LocationType) : undefined,
      toId: diff > 0 ? data.locationId : undefined,
      createdBy: userId,
    });
  });
};

// ---------------------------------------------------------------------------
// Stock: Set min quantity threshold (for low-stock alerting)
// ---------------------------------------------------------------------------

export const setMinStock = async (data: SetMinStockInput) => {
  if (data.locationType === 'WAREHOUSE') {
    const wh = await repo.findWarehouseById(data.locationId);
    if (!wh) throw notFound('Warehouse');
    return repo.updateMinWarehouseStock(data.locationId, data.itemId, data.minQuantity);
  }
  const outlet = await repo.findOutletById(data.locationId);
  if (!outlet) throw notFound('Outlet');
  return repo.updateMinOutletStock(data.locationId, data.itemId, data.minQuantity);
};

// ---------------------------------------------------------------------------
// Stock: Deduct for a sale (called by Sales module)
// ---------------------------------------------------------------------------

export const deductSaleStock = async (
  outletId: string,
  itemId: string,
  quantity: number,
  userId: string,
  saleId?: string,
) => {
  await prisma.$transaction(async (tx) => {
    const stock = await repo.getOutletStockInTx(tx, outletId, itemId);
    if (!stock || stock.quantity < quantity) {
      throw new AppError(
        `Insufficient outlet stock (available: ${stock?.quantity ?? 0})`,
        400,
      );
    }
    await repo.upsertOutletStock(tx, outletId, itemId, -quantity);
    await repo.createMovement(tx, {
      movementType: MovementType.SALE,
      quantity,
      referenceId: saleId,
      itemId,
      fromType: LocationType.OUTLET,
      fromId: outletId,
      createdBy: userId,
    });
  });
};

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------

export const listMovements = async (input: ListMovementsInput) => {
  const { skip, take } = getPaginationArgs(input);
  const [data, total] = await repo.listMovements(skip, take, {
    itemId: input.itemId,
    movementType: input.movementType as MovementType | undefined,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });
  return { data, total, page: input.page, limit: input.limit };
};
