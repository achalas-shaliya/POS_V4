import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import * as ctrl from './reports.controller';

const router = Router();

router.use(authenticate);

// ---------------------------------------------------------------------------
// Sales reports — GET /api/v1/reports/sales/*
// ---------------------------------------------------------------------------
router.get('/sales/summary',     authorize('reports:read'), ctrl.salesSummary);
router.get('/sales/by-period',   authorize('reports:read'), ctrl.salesByPeriod);
router.get('/sales/top-items',   authorize('reports:read'), ctrl.topItems);

// ---------------------------------------------------------------------------
// Repair reports — GET /api/v1/reports/repairs/*
// ---------------------------------------------------------------------------
router.get('/repairs/summary',     authorize('reports:read'), ctrl.repairSummary);
router.get('/repairs/turnaround',  authorize('reports:read'), ctrl.repairTurnaround);

// ---------------------------------------------------------------------------
// Inventory reports — GET /api/v1/reports/inventory/*
// ---------------------------------------------------------------------------
router.get('/inventory/snapshot',   authorize('reports:read'), ctrl.inventorySnapshot);
router.get('/inventory/movements',  authorize('reports:read'), ctrl.inventoryMovements);

// ---------------------------------------------------------------------------
// Cash register reports — GET /api/v1/reports/cash/*
// ---------------------------------------------------------------------------
router.get('/cash/summary',   authorize('reports:read'), ctrl.cashSummary);
router.get('/cash/variance',  authorize('reports:read'), ctrl.cashVariance);

export default router;
