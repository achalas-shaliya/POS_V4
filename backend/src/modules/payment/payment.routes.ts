import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
  listPaymentsSchema,
  paymentIdParamSchema,
  paymentRepairIdParamSchema,
  paymentSaleIdParamSchema,
  recordRepairPaymentSchema,
  recordSalePaymentSchema,
  settleRepairSchema,
} from './payment.schema';
import * as ctrl from './payment.controller';

const router = Router();

router.use(authenticate);

// ---------------------------------------------------------------------------
// Generic transactions
// ---------------------------------------------------------------------------
router.get('/', authorize('payments:read'), validateRequest({ query: listPaymentsSchema }), ctrl.listTransactions);
router.get('/:id', authorize('payments:read'), validateRequest({ params: paymentIdParamSchema }), ctrl.getTransactionById);

// ---------------------------------------------------------------------------
// Sale payments
//   POST  /payments/sales        — record an additional payment for a sale
//   GET   /payments/sales/:saleId/summary — paid vs outstanding breakdown
// ---------------------------------------------------------------------------
router.post(
  '/sales',
  authorize('payments:create'),
  validateRequest({ body: recordSalePaymentSchema }),
  ctrl.recordSalePayment,
);

router.get(
  '/sales/:saleId/summary',
  authorize('payments:read'),
  validateRequest({ params: paymentSaleIdParamSchema }),
  ctrl.getSalePaymentSummary,
);

// ---------------------------------------------------------------------------
// Repair payments
//   POST  /payments/repairs/:repairId        — record advance or partial pay
//   POST  /payments/repairs/:repairId/settle — collect balance + mark DELIVERED
//   GET   /payments/repairs/:repairId/summary — paid vs outstanding breakdown
// ---------------------------------------------------------------------------
router.post(
  '/repairs/:repairId',
  authorize('payments:create'),
  validateRequest({ params: paymentRepairIdParamSchema, body: recordRepairPaymentSchema }),
  ctrl.recordRepairPayment,
);

router.post(
  '/repairs/:repairId/settle',
  authorize('payments:create'),
  validateRequest({ params: paymentRepairIdParamSchema, body: settleRepairSchema }),
  ctrl.settleRepair,
);

router.get(
  '/repairs/:repairId/summary',
  authorize('payments:read'),
  validateRequest({ params: paymentRepairIdParamSchema }),
  ctrl.getRepairPaymentSummary,
);

export default router;
