import { Response, NextFunction } from 'express';
import { forbidden } from './errorHandler';
import type { AuthenticatedRequest } from '../types';

/**
 * authorize(...permissions) — RBAC middleware factory.
 *
 * Requires authenticate middleware to run first.
 * Passes if the authenticated user holds ANY of the listed permission strings.
 *
 * Usage:
 *   router.get('/admin/users', authenticate, authorize('users:read'), handler)
 */
export const authorize =
  (...required: string[]) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      return next(forbidden('Access denied'));
    }

    if (required.length === 0) {
      // No specific permission required — authenticated user is sufficient
      return next();
    }

    const hasPermission = required.some((p) => user.permissions?.includes(p));

    if (!hasPermission) {
      return next(forbidden('You do not have permission to perform this action'));
    }

    next();
  };
