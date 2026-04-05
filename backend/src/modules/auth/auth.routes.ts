import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { validateRequest } from '../../shared/middleware/validateRequest';
import {
  loginSchema,
  refreshTokenSchema,
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  createRoleSchema,
  assignPermissionsSchema,
} from './auth.schema';
import * as ctrl from './auth.controller';

const router = Router();

// ---------------------------------------------------------------------------
// Public auth endpoints
// ---------------------------------------------------------------------------
router.post('/login', validateRequest({ body: loginSchema }), ctrl.login);
router.post('/refresh', validateRequest({ body: refreshTokenSchema }), ctrl.refresh);

// ---------------------------------------------------------------------------
// Protected — current user
// ---------------------------------------------------------------------------
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.getMe);
router.patch(
  '/me/password',
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  ctrl.changePassword,
);

// ---------------------------------------------------------------------------
// Admin — user management
// ---------------------------------------------------------------------------
router.post(
  '/users',
  authenticate,
  authorize('users:create'),
  validateRequest({ body: createUserSchema }),
  ctrl.createUser,
);
router.get('/users', authenticate, authorize('users:read'), ctrl.listUsers);
router.put(
  '/users/:id',
  authenticate,
  authorize('users:update'),
  validateRequest({ body: updateUserSchema }),
  ctrl.updateUser,
);

// ---------------------------------------------------------------------------
// Admin — role & permission management
// ---------------------------------------------------------------------------
router.get('/roles', authenticate, authorize('roles:read'), ctrl.listRoles);
router.post(
  '/roles',
  authenticate,
  authorize('roles:create'),
  validateRequest({ body: createRoleSchema }),
  ctrl.createRole,
);
router.put(
  '/roles/:id/permissions',
  authenticate,
  authorize('roles:update'),
  validateRequest({ body: assignPermissionsSchema }),
  ctrl.assignPermissions,
);
router.get(
  '/permissions',
  authenticate,
  authorize('roles:read'),
  ctrl.listPermissions,
);

export default router;
