import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
	checkoutSchema,
	listSalesSchema,
	receiptNoParamSchema,
	saleIdParamSchema,
	voidSaleSchema,
	createCustomerSchema,
	listCustomersSchema,
} from './sales.schema';
import * as ctrl from './sales.controller';

const router = Router();

// All sales routes require a valid JWT
router.use(authenticate);

// ---------------------------------------------------------------------------
// POS checkout — the primary action
// (validation is done inside the controller via .parse() to get typed data)
// ---------------------------------------------------------------------------
router.post('/checkout', authorize('sales:create'), validateRequest({ body: checkoutSchema }), ctrl.checkout);

// ---------------------------------------------------------------------------
// Customers — must be registered before /:id to avoid route shadowing
// ---------------------------------------------------------------------------
router.get('/customers', authorize('sales:read'), validateRequest({ query: listCustomersSchema }), ctrl.listCustomers);
router.post('/customers', authorize('sales:create'), validateRequest({ body: createCustomerSchema }), ctrl.createCustomer);

// ---------------------------------------------------------------------------
// Sales queries
// ---------------------------------------------------------------------------
router.get('/', authorize('sales:read'), validateRequest({ query: listSalesSchema }), ctrl.listSales);
router.get('/receipt/:receiptNo', authorize('sales:read'), validateRequest({ params: receiptNoParamSchema }), ctrl.getByReceiptNo);
router.get('/:id', authorize('sales:read'), validateRequest({ params: saleIdParamSchema }), ctrl.getSale);

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------
router.post('/:id/void', authorize('sales:manage'), validateRequest({ params: saleIdParamSchema, body: voidSaleSchema }), ctrl.voidSale);

// ---------------------------------------------------------------------------

export default router;
