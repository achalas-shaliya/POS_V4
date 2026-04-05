import { Request, Response, NextFunction } from 'express';
import * as service from './auth.service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../shared/utils/response';
import { getPaginationArgs, paginationSchema } from '../../shared/utils/pagination';
import type { AuthenticatedRequest } from '../../shared/types';
import type {
  LoginInput,
  RefreshTokenInput,
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  CreateRoleInput,
  AssignPermissionsInput,
} from './auth.schema';

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await service.login(req.body as LoginInput);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { refreshToken } = req.body as RefreshTokenInput;
    const tokens = await service.refreshTokens(refreshToken);
    sendSuccess(res, tokens, 'Tokens refreshed');
  } catch (err) {
    next(err);
  }
};

export const logout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await service.logout(req.user!.id);
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const profile = await service.getMe(req.user!.id);
    sendSuccess(res, profile, 'Profile retrieved');
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await service.changePassword(req.user!.id, req.body as ChangePasswordInput);
    sendSuccess(res, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// User management (admin)
// ---------------------------------------------------------------------------

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await service.createUser(req.body as CreateUserInput);
    sendCreated(res, user, 'User created');
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = paginationSchema.parse(req.query);
    const { skip, take, search } = getPaginationArgs(parsed);
    const { data, total } = await service.listUsers(skip, take, search);
    sendPaginated(res, data, { total, page: parsed.page, limit: parsed.limit }, 'Users retrieved');
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await service.updateUser(req.params.id as string, req.body as UpdateUserInput);
    sendSuccess(res, user, 'User updated');
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Role management (admin)
// ---------------------------------------------------------------------------

export const listRoles = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const roles = await service.listRoles();
    sendSuccess(res, roles, 'Roles retrieved');
  } catch (err) {
    next(err);
  }
};

export const createRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const role = await service.createRole(req.body as CreateRoleInput);
    sendCreated(res, role, 'Role created');
  } catch (err) {
    next(err);
  }
};

export const assignPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const role = await service.assignPermissions(req.params.id as string, req.body as AssignPermissionsInput);
    sendSuccess(res, role, 'Permissions assigned');
  } catch (err) {
    next(err);
  }
};

export const listPermissions = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const permissions = await service.listPermissions();
    sendSuccess(res, permissions, 'Permissions retrieved');
  } catch (err) {
    next(err);
  }
};
