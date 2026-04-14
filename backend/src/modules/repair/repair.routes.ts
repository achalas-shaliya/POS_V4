import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
	addAdvanceSchema,
	addPartSchema,
	createRepairJobSchema,
	listRepairJobsSchema,
	repairIdParamSchema,
	repairJobNoParamSchema,
	repairPartParamSchema,
	updateRepairJobSchema,
	updateStatusSchema,
	updatePartDiscountSchema,
	updatePartQuantitySchema,
	updatePartUsedSchema,
} from './repair.schema';
import * as ctrl from './repair.controller';

const router = Router();

router.use(authenticate);

// ---------------------------------------------------------------------------
// Repair jobs
// ---------------------------------------------------------------------------
router.post('/', authorize('repairs:create'), validateRequest({ body: createRepairJobSchema }), ctrl.createJob);
router.get('/', authorize('repairs:read'), validateRequest({ query: listRepairJobsSchema }), ctrl.listJobs);
router.get('/job/:jobNo', authorize('repairs:read'), validateRequest({ params: repairJobNoParamSchema }), ctrl.getJobByNo);
router.get('/:id', authorize('repairs:read'), validateRequest({ params: repairIdParamSchema }), ctrl.getJob);
router.patch('/:id', authorize('repairs:update'), validateRequest({ params: repairIdParamSchema, body: updateRepairJobSchema }), ctrl.updateJob);

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------
router.post('/:id/status', authorize('repairs:update'), validateRequest({ params: repairIdParamSchema, body: updateStatusSchema }), ctrl.updateStatus);

// ---------------------------------------------------------------------------
// Parts management
// ---------------------------------------------------------------------------
router.post('/:id/parts', authorize('repairs:update'), validateRequest({ params: repairIdParamSchema, body: addPartSchema }), ctrl.addPart);
router.delete('/:id/parts/:partId', authorize('repairs:update'), validateRequest({ params: repairPartParamSchema }), ctrl.removePart);
router.patch('/:id/parts/:partId/discount', authorize('repairs:update'), validateRequest({ params: repairPartParamSchema, body: updatePartDiscountSchema }), ctrl.updatePartDiscount);
router.patch('/:id/parts/:partId/quantity', authorize('repairs:update'), validateRequest({ params: repairPartParamSchema, body: updatePartQuantitySchema }), ctrl.updatePartQuantity);
router.patch('/:id/parts/:partId/used', authorize('repairs:update'), validateRequest({ params: repairPartParamSchema, body: updatePartUsedSchema }), ctrl.updatePartUsed);

// ---------------------------------------------------------------------------
// Advance payments
// ---------------------------------------------------------------------------
router.post('/:id/advances', authorize('repairs:update'), validateRequest({ params: repairIdParamSchema, body: addAdvanceSchema }), ctrl.addAdvance);

// ---------------------------------------------------------------------------
// Balance summary
// ---------------------------------------------------------------------------
router.get('/:id/balance', authorize('repairs:read'), validateRequest({ params: repairIdParamSchema }), ctrl.getBalance);

export default router;
