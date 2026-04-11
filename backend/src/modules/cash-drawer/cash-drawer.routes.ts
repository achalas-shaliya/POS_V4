import { Router } from 'express';
import { openCashDrawer } from './cash-drawer.controller';
import { authenticate } from '../../shared/middleware/authenticate';

const router = Router();

router.post('/open', authenticate, openCashDrawer);

export default router;
