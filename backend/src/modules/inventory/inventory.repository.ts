import { prisma } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { LocationType, MovementType } from '../../generated/prisma/enums';
import type {
  CreateItemInput,
  UpdateItemInput,
  CreateCategoryInput,
  CreateBrandInput,
  CreateWarehouseInput,
  CreateOutletInput,
} from './inventory.schema';

// Shorthand for transaction client
type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const ITEM_BASE_INCLUDE = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} satisfies Prisma.ItemInclude;

export const findItemById = (id: string) =>
  prisma.item.findUnique({
    where: { id },
    include: {
      ...ITEM_BASE_INCLUDE,
      warehouseStocks: {
        include: { warehouse: { select: { id: true, name: true } } },
      },
      outletStocks: {
        include: { outlet: { select: { id: true, name: true } } },
      },
    },
  });

export const findItemBySku = (sku: string) =>
  prisma.item.findUnique({ where: { sku } });

export const findItemsByIds = (ids: string[]) =>
  prisma.item.findMany({ where: { id: { in: ids } } });

export const listItems = async (
  skip: number,
  take: number,
  filters: {
    search?: string;
    type?: 'ACCESSORY' | 'SPARE_PART' | 'TOOL';
    categoryId?: string;
    brandId?: string;
    isActive?: boolean;
  },
): Promise<[Awaited<ReturnType<typeof prisma.item.findMany>>, number]> => {
  const where: Prisma.ItemWhereInput = {
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.type && { type: filters.type }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
    ...(filters.brandId && { brandId: filters.brandId }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search } },
        { sku: { contains: filters.search } },
      ],
    }),
  };

  return prisma.$transaction([
    prisma.item.findMany({ where, skip, take, include: ITEM_BASE_INCLUDE, orderBy: { name: 'asc' } }),
    prisma.item.count({ where }),
  ]);
};

export const createItem = (data: CreateItemInput) =>
  prisma.item.create({
    data: {
      sku: data.sku,
      name: data.name,
      description: data.description,
      type: data.type,
      unit: data.unit,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      discountPrice: data.discountPrice ?? 0,
      categoryId: data.categoryId,
      brandId: data.brandId,
    },
    include: ITEM_BASE_INCLUDE,
  });

export const updateItem = (id: string, data: UpdateItemInput) =>
  prisma.item.update({
    where: { id },
    data: {
      ...(data.sku !== undefined && { sku: data.sku }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
      ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
      ...(data.discountPrice !== undefined && { discountPrice: data.discountPrice }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.brandId !== undefined && { brandId: data.brandId }),
    },
    include: ITEM_BASE_INCLUDE,
  });

export const deactivateItem = (id: string) =>
  prisma.item.update({ where: { id }, data: { isActive: false } });

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const findAllCategories = () =>
  prisma.category.findMany({
    include: { parent: { select: { id: true, name: true } }, _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });

export const findCategoryById = (id: string) =>
  prisma.category.findUnique({ where: { id } });

export const findCategoryByName = (name: string) =>
  prisma.category.findUnique({ where: { name } });

export const createCategory = (data: CreateCategoryInput) =>
  prisma.category.create({ data });

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const findAllBrands = () =>
  prisma.brand.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });

export const findBrandById = (id: string) =>
  prisma.brand.findUnique({ where: { id } });

export const findBrandByName = (name: string) =>
  prisma.brand.findUnique({ where: { name } });

export const createBrand = (data: CreateBrandInput) =>
  prisma.brand.create({ data });

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export const findAllWarehouses = () =>
  prisma.warehouse.findMany({ orderBy: { name: 'asc' } });

export const findWarehouseById = (id: string) =>
  prisma.warehouse.findUnique({ where: { id } });

export const createWarehouse = (data: CreateWarehouseInput) =>
  prisma.warehouse.create({ data });

export const getWarehouseStock = (
  warehouseId: string,
  skip: number,
  take: number,
  filters: { search?: string; lowStockOnly?: boolean },
) => {
  const where: Prisma.WarehouseStockWhereInput = {
    warehouseId,
    ...(filters.lowStockOnly && {
      quantity: { lte: prisma.warehouseStock.fields.minQuantity },
    }),
    ...(filters.search && {
      item: {
        OR: [
          { name: { contains: filters.search } },
          { sku: { contains: filters.search } },
        ],
      },
    }),
  };

  return prisma.$transaction([
    prisma.warehouseStock.findMany({
      where,
      skip,
      take,
      include: { item: { include: ITEM_BASE_INCLUDE } },
      orderBy: { item: { name: 'asc' } },
    }),
    prisma.warehouseStock.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------

export const findAllOutlets = () =>
  prisma.outlet.findMany({ orderBy: { name: 'asc' } });

export const findOutletById = (id: string) =>
  prisma.outlet.findUnique({ where: { id } });

export const createOutlet = (data: CreateOutletInput) =>
  prisma.outlet.create({ data });

export const getOutletStock = (
  outletId: string,
  skip: number,
  take: number,
  filters: { search?: string; lowStockOnly?: boolean },
) => {
  const where: Prisma.OutletStockWhereInput = {
    outletId,
    ...(filters.lowStockOnly && {
      quantity: { lte: prisma.outletStock.fields.minQuantity },
    }),
    ...(filters.search && {
      item: {
        OR: [
          { name: { contains: filters.search } },
          { sku: { contains: filters.search } },
        ],
      },
    }),
  };

  return prisma.$transaction([
    prisma.outletStock.findMany({
      where,
      skip,
      take,
      include: { item: { include: ITEM_BASE_INCLUDE } },
      orderBy: { item: { name: 'asc' } },
    }),
    prisma.outletStock.count({ where }),
  ]);
};

// ---------------------------------------------------------------------------
// Transactional stock helpers — these always receive a tx client
// ---------------------------------------------------------------------------

export const getWarehouseStockInTx = (tx: Tx, warehouseId: string, itemId: string) =>
  tx.warehouseStock.findUnique({
    where: { warehouseId_itemId: { warehouseId, itemId } },
  });

export const getOutletStockInTx = (tx: Tx, outletId: string, itemId: string) =>
  tx.outletStock.findUnique({
    where: { outletId_itemId: { outletId, itemId } },
  });

export const upsertWarehouseStock = (
  tx: Tx,
  warehouseId: string,
  itemId: string,
  increment: number,
) =>
  tx.warehouseStock.upsert({
    where: { warehouseId_itemId: { warehouseId, itemId } },
    update: { quantity: { increment } },
    create: { warehouseId, itemId, quantity: increment },
  });

export const upsertOutletStock = (
  tx: Tx,
  outletId: string,
  itemId: string,
  increment: number,
) =>
  tx.outletStock.upsert({
    where: { outletId_itemId: { outletId, itemId } },
    update: { quantity: { increment } },
    create: { outletId, itemId, quantity: increment },
  });

export const setWarehouseStock = (
  tx: Tx,
  warehouseId: string,
  itemId: string,
  quantity: number,
) =>
  tx.warehouseStock.upsert({
    where: { warehouseId_itemId: { warehouseId, itemId } },
    update: { quantity },
    create: { warehouseId, itemId, quantity },
  });

export const setOutletStock = (
  tx: Tx,
  outletId: string,
  itemId: string,
  quantity: number,
) =>
  tx.outletStock.upsert({
    where: { outletId_itemId: { outletId, itemId } },
    update: { quantity },
    create: { outletId, itemId, quantity },
  });

export const updateMinWarehouseStock = (
  warehouseId: string,
  itemId: string,
  minQuantity: number,
) =>
  prisma.warehouseStock.upsert({
    where: { warehouseId_itemId: { warehouseId, itemId } },
    update: { minQuantity },
    create: { warehouseId, itemId, quantity: 0, minQuantity },
  });

export const updateMinOutletStock = (
  outletId: string,
  itemId: string,
  minQuantity: number,
) =>
  prisma.outletStock.upsert({
    where: { outletId_itemId: { outletId, itemId } },
    update: { minQuantity },
    create: { outletId, itemId, quantity: 0, minQuantity },
  });

// ---------------------------------------------------------------------------
// Stock movements
// ---------------------------------------------------------------------------

export const createMovement = (
  tx: Tx,
  data: {
    movementType: MovementType;
    quantity: number;
    note?: string;
    referenceId?: string;
    itemId: string;
    fromType?: LocationType;
    fromId?: string;
    toType?: LocationType;
    toId?: string;
    createdBy: string;
  },
) => tx.stockMovement.create({ data });

export const listMovements = (
  skip: number,
  take: number,
  filters: {
    itemId?: string;
    movementType?: MovementType;
    fromDate?: string;
    toDate?: string;
  },
) => {
  const where: Prisma.StockMovementWhereInput = {
    ...(filters.itemId && { itemId: filters.itemId }),
    ...(filters.movementType && { movementType: filters.movementType }),
    ...((filters.fromDate || filters.toDate) && {
      createdAt: {
        ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
        ...(filters.toDate && { lte: new Date(filters.toDate) }),
      },
    }),
  };

  return prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      skip,
      take,
      include: {
        item: { select: { id: true, sku: true, name: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.count({ where }),
  ]);
};
