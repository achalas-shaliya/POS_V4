import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import {
  AppError,
  notFound,
  conflict,
  unauthorized,
} from "../../shared/middleware/errorHandler";
import { StatusCodes } from "http-status-codes";
import * as repo from "./auth.repository";
import type {
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  CreateRoleInput,
  AssignPermissionsInput,
} from "./auth.schema";

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
const SALT_ROUNDS = 12;

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

const signAccess = (payload: Omit<JwtPayload, "iat" | "exp">): string =>
  jwt.sign(payload, env.JWT_SECRET!, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);

const signRefresh = (userId: string): string =>
  jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET!, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);

const parseRefreshExpiry = (): Date => {
  const raw = env.JWT_REFRESH_EXPIRES_IN ?? "30d";
  const unit = raw.slice(-1);
  const value = parseInt(raw.slice(0, -1), 10);
  const ms: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return new Date(Date.now() + value * (ms[unit] ?? 86_400_000));
};

const extractPermissions = (
  user: NonNullable<Awaited<ReturnType<typeof repo.findUserWithPermissions>>>,
): string[] => user.role.permissions.map((rp) => rp.permission.name);

// ---------------------------------------------------------------------------
// Auth service
// ---------------------------------------------------------------------------

export const login = async (input: LoginInput) => {
  const user = await repo.findUserWithPermissions(input.email);
  console.log("Login attempt for email:", user);

  if (!user || !user.isActive) {
    throw new AppError("Invalid email or password", StatusCodes.UNAUTHORIZED);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid email or password", StatusCodes.UNAUTHORIZED);
  }

  const permissions = extractPermissions(user);

  const accessToken = signAccess({
    sub: user.id,
    email: user.email,
    role: user.role.name,
    permissions,
  });
  const refreshToken = signRefresh(user.id);

  await repo.createRefreshToken(user.id, refreshToken, parseRefreshExpiry());

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      permissions,
    },
  };
};

export const refreshTokens = async (token: string) => {
  // Verify the refresh token is structurally valid
  let decoded: { sub: string };
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET!) as { sub: string };
  } catch {
    throw unauthorized("Invalid or expired refresh token");
  }

  // Check it exists and hasn't been revoked
  const stored = await repo.findRefreshToken(token);
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized("Refresh token has been revoked or expired");
  }

  if (stored.userId !== decoded.sub) {
    throw unauthorized("Token mismatch");
  }

  // Revoke old token (rotation)
  await repo.revokeRefreshToken(token);

  const user = stored.user;
  const permissions = user.role.permissions.map((rp) => rp.permission.name);

  const accessToken = signAccess({
    sub: user.id,
    email: user.email,
    role: user.role.name,
    permissions,
  });
  const newRefreshToken = signRefresh(user.id);
  await repo.createRefreshToken(user.id, newRefreshToken, parseRefreshExpiry());

  return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (userId: string) => {
  await repo.revokeAllUserRefreshTokens(userId);
};

export const getMe = async (userId: string) => {
  const user = await repo.findUserById(userId);
  if (!user) throw notFound("User");

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role.name,
    permissions: extractPermissions(user),
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
};

// ---------------------------------------------------------------------------
// User management service
// ---------------------------------------------------------------------------

export const createUser = async (input: CreateUserInput) => {
  const existing = await repo.findUserByEmail(input.email);
  if (existing) throw conflict("Email already in use");

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await repo.createUser({ ...input, passwordHash });
  return sanitizeUser(user);
};

export const updateUser = async (id: string, input: UpdateUserInput) => {
  const existing = await repo.findUserById(id);
  if (!existing) throw notFound("User");

  if (input.email && input.email !== existing.email) {
    const emailTaken = await repo.findUserByEmail(input.email);
    if (emailTaken) throw conflict("Email already in use");
  }

  const updated = await repo.updateUser(id, input);
  return sanitizeUser(updated);
};

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
) => {
  const user = await repo.findUserById(userId);
  if (!user) throw notFound("User");

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid)
    throw new AppError(
      "Current password is incorrect",
      StatusCodes.BAD_REQUEST,
    );

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await repo.updateUserPassword(userId, passwordHash);
  // Revoke all refresh tokens to force re-login on all devices
  await repo.revokeAllUserRefreshTokens(userId);
};

export const listUsers = async (
  skip: number,
  take: number,
  search?: string,
) => {
  const [users, total] = await repo.listUsers(skip, take, search);
  return { data: users.map(sanitizeUser), total };
};

// ---------------------------------------------------------------------------
// Role management service
// ---------------------------------------------------------------------------

export const listRoles = () => repo.findAllRoles();

export const createRole = async (input: CreateRoleInput) => {
  const existing = await repo.findRoleByName(input.name);
  if (existing) throw conflict(`Role "${input.name}" already exists`);
  return repo.createRole(input);
};

export const assignPermissions = async (
  roleId: string,
  input: AssignPermissionsInput,
) => {
  const role = await repo.findRoleById(roleId);
  if (!role) throw notFound("Role");

  const found = await repo.findPermissionsByIds(input.permissionIds);
  if (found.length !== input.permissionIds.length) {
    throw new AppError(
      "One or more permission IDs are invalid",
      StatusCodes.BAD_REQUEST,
    );
  }

  await repo.assignPermissionsToRole(roleId, input.permissionIds);
  return repo.findRoleById(roleId);
};

export const listPermissions = () => repo.findAllPermissions();

// ---------------------------------------------------------------------------
// Private helper — strip passwordHash from response
// ---------------------------------------------------------------------------
const sanitizeUser = <T extends { passwordHash: string }>(
  user: T,
): Omit<T, "passwordHash"> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
};
