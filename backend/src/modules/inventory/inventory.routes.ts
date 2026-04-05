import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
  createItemSchema,
  updateItemSchema,
  createCategorySchema,
  createBrandSchema,
  createWarehouseSchema,
  createOutletSchema,
  purchaseStockSchema,
  transferStockSchema,
  adjustStockSchema,
  setMinStockSchema,
} from './inventory.schema';
import * as ctrl from './inventory.controller';

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
router.get('/items', authorize('inventory:read'), ctrl.listItems);
router.post('/items', authorize('inventory:create'), validateRequest({ body: createItemSchema }), ctrl.createItem);
router.get('/items/:id', authorize('inventory:read'), ctrl.getItem);
router.patch('/items/:id', authorize('inventory:update'), validateRequest({ body: updateItemSchema }), ctrl.updateItem);
router.delete('/items/:id', authorize('inventory:delete'), ctrl.deactivateItem);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
router.get('/categories', authorize('inventory:read'), ctrl.listCategories);
router.post('/categories', authorize('inventory:create'), validateRequest({ body: createCategorySchema }), ctrl.createCategory);

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
router.get('/brands', authorize('inventory:read'), ctrl.listBrands);
router.post('/brands', authorize('inventory:create'), validateRequest({ body: createBrandSchema }), ctrl.createBrand);

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------
router.get('/warehouses', authorize('inventory:read'), ctrl.listWarehouses);
router.post('/warehouses', authorize('inventory:manage'), validateRequest({ body: createWarehouseSchema }), ctrl.createWarehouse);
router.get('/warehouses/:id/stock', authorize('inventory:read'), ctrl.getWarehouseStock);

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------
router.get('/outlets', authorize('inventory:read'), ctrl.listOutlets);
router.post('/outlets', authorize('inventory:manage'), validateRequest({ body: createOutletSchema }), ctrl.createOutlet);
router.get('/outlets/:id/stock', authorize('inventory:read'), ctrl.getOutletStock);

// ---------------------------------------------------------------------------
// Stock operations
// ---------------------------------------------------------------------------
router.post(
  '/purchases',
  authorize('inventory:manage'),
  validateRequest({ body: purchaseStockSchema }),
  ctrl.purchaseStock,
);
router.post(
  '/transfers',
  authorize('inventory:manage'),
  validateRequest({ body: transferStockSchema }),
  ctrl.transferStock,
);
router.post(
  '/adjustments',
  authorize('inventory:manage'),
  validateRequest({ body: adjustStockSchema }),
  ctrl.adjustStock,
);
router.patch(
  '/min-stock',
  authorize('inventory:manage'),
  validateRequest({ body: setMinStockSchema }),
  ctrl.setMinStock,
);

// ---------------------------------------------------------------------------
// Movement history
// ---------------------------------------------------------------------------
router.get('/movements', authorize('inventory:read'), ctrl.listMovements);

export default router;
