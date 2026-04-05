import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
  cashInOutSchema,
  cashRegisterIdParamSchema,
  closeRegisterSchema,
  listMovementsSchema,
  listRegistersSchema,
  openRegisterSchema,
} from './cash.schema';
import * as ctrl from './cash.controller';

const router = Router();

router.use(authenticate);

// ---------------------------------------------------------------------------
// My register — cashier self-service
// ---------------------------------------------------------------------------

// Open a new register for the authenticated user
router.post(
  '/',
  authorize('cash:create'),
  validateRequest({ body: openRegisterSchema }),
  ctrl.openRegister,
);

// Get my own open register
router.get(
  '/me',
  authorize('cash:read'),
  ctrl.getMyOpenRegister,
);

// ---------------------------------------------------------------------------
// Register detail & list (managers can see all)
// ---------------------------------------------------------------------------

router.get(
  '/',
  authorize('cash:read'),
  validateRequest({ query: listRegistersSchema }),
  ctrl.listRegisters,
);

router.get(
  '/:id',
  authorize('cash:read'),
  validateRequest({ params: cashRegisterIdParamSchema }),
  ctrl.getRegisterById,
);

// Live running cash balance for a register
router.get(
  '/:id/balance',
  authorize('cash:read'),
  validateRequest({ params: cashRegisterIdParamSchema }),
  ctrl.getRegisterBalance,
);

// ---------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------

// Paginated list of all movements in a register
router.get(
  '/:id/movements',
  authorize('cash:read'),
  validateRequest({ params: cashRegisterIdParamSchema, query: listMovementsSchema }),
  ctrl.listMovements,
);

// Manual cash in (float top-up, received petty cash, etc.)
router.post(
  '/:id/cash-in',
  authorize('cash:update'),
  validateRequest({ params: cashRegisterIdParamSchema, body: cashInOutSchema }),
  ctrl.cashIn,
);

// Manual cash out (bank deposit, paying an expense, etc.)
router.post(
  '/:id/cash-out',
  authorize('cash:update'),
  validateRequest({ params: cashRegisterIdParamSchema, body: cashInOutSchema }),
  ctrl.cashOut,
);

// ---------------------------------------------------------------------------
// Close register — cashier submits physically counted cash
// ---------------------------------------------------------------------------

router.post(
  '/:id/close',
  authorize('cash:update'),
  validateRequest({ params: cashRegisterIdParamSchema, body: closeRegisterSchema }),
  ctrl.closeRegister,
);

export default router;
