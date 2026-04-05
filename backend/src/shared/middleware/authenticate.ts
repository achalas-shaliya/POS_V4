import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { unauthorized } from './errorHandler';
import type { AuthenticatedRequest, JwtPayload } from '../types';

/**
 * Authenticate middleware — validates Bearer JWT and attaches decoded payload to req.user.
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('No token provided'));
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET!) as JwtPayload;
    (req as AuthenticatedRequest).user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
    };
    next();
  } catch {
    next(unauthorized('Invalid or expired access token'));
  }
};
