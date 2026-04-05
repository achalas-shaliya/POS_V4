import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
	cancelTransferSchema,
	createTransferSchema,
	dispatchTransferSchema,
	listTransfersSchema,
	receiveTransferSchema,
	transferIdParamSchema,
	transferNoParamSchema,
} from './transfer.schema';
import * as ctrl from './transfer.controller';

const router = Router();

router.use(authenticate);

// List & detail
router.get('/', authorize('transfers:read'), validateRequest({ query: listTransfersSchema }), ctrl.listTransfers);
router.get('/no/:transferNo', authorize('transfers:read'), validateRequest({ params: transferNoParamSchema }), ctrl.getTransferByNo);
router.get('/:id', authorize('transfers:read'), validateRequest({ params: transferIdParamSchema }), ctrl.getTransferById);

// Create a transfer request
router.post('/', authorize('transfers:create'), validateRequest({ body: createTransferSchema }), ctrl.createTransfer);

// State transitions
router.post('/:id/dispatch', authorize('transfers:update'), validateRequest({ params: transferIdParamSchema, body: dispatchTransferSchema }), ctrl.dispatchTransfer);
router.post('/:id/receive', authorize('transfers:update'), validateRequest({ params: transferIdParamSchema, body: receiveTransferSchema }), ctrl.receiveTransfer);
router.post('/:id/cancel', authorize('transfers:update'), validateRequest({ params: transferIdParamSchema, body: cancelTransferSchema }), ctrl.cancelTransfer);

export default router;
