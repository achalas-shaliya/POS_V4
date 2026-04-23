import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
	approveReturnSchema,
	createReturnSchema,
	createSupplierReturnSchema,
	listReturnsSchema,
	listSupplierReturnsSchema,
	listReturnStockSchema,
	rejectReturnSchema,
	returnIdParamSchema,
	returnNoParamSchema,
} from './returns.schema';
import * as ctrl from './returns.controller';

const router = Router();

router.use(authenticate);

// List / create
router.get('/', authorize('returns:read'), validateRequest({ query: listReturnsSchema }), ctrl.listReturns);
router.post('/', authorize('returns:create'), validateRequest({ body: createReturnSchema }), ctrl.createReturn);

// Return stock and supplier-return operations
router.get('/stock', authorize('returns:read'), validateRequest({ query: listReturnStockSchema }), ctrl.listReturnStock);
router.get('/supplier-returns', authorize('returns:read'), validateRequest({ query: listSupplierReturnsSchema }), ctrl.listSupplierReturns);
router.post('/supplier-returns', authorize('returns:update'), validateRequest({ body: createSupplierReturnSchema }), ctrl.createSupplierReturn);

// Lookups
router.get('/no/:returnNo', authorize('returns:read'), validateRequest({ params: returnNoParamSchema }), ctrl.getReturnByNo);
router.get('/:id', authorize('returns:read'), validateRequest({ params: returnIdParamSchema }), ctrl.getReturnById);

// Status transitions (manager-level)
router.post('/:id/approve', authorize('returns:update'), validateRequest({ params: returnIdParamSchema, body: approveReturnSchema }), ctrl.approveReturn);
router.post('/:id/reject', authorize('returns:update'), validateRequest({ params: returnIdParamSchema, body: rejectReturnSchema }), ctrl.rejectReturn);

export default router;
