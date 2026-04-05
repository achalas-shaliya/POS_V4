import { prisma } from '../../config/database';
import type { CreateUserInput, UpdateUserInput, CreateRoleInput } from './auth.schema';

// ---------------------------------------------------------------------------
// User repository — all DB access for users
// ---------------------------------------------------------------------------

/** Full user with role + permissions (used for login/token generation) */
export const findUserWithPermissions = (email: string) =>
  prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

export const findUserById = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email } });

export const createUser = (
  data: CreateUserInput & { passwordHash: string },
) =>
  prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      phone: data.phone,
      roleId: data.roleId,
    },
    include: { role: true },
  });

export const updateUser = (id: string, data: UpdateUserInput) =>
  prisma.user.update({
    where: { id },
    data: {
      ...(data.email && { email: data.email }),
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.roleId && { roleId: data.roleId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: { role: true },
  });

export const updateUserPassword = (id: string, passwordHash: string) =>
  prisma.user.update({ where: { id }, data: { passwordHash } });

export const listUsers = (skip: number, take: number, search?: string) =>
  prisma.$transaction([
    prisma.user.findMany({
      skip,
      take,
      where: search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({
      where: search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
    }),
  ]);

// ---------------------------------------------------------------------------
// Refresh token repository
// ---------------------------------------------------------------------------

export const createRefreshToken = (
  userId: string,
  token: string,
  expiresAt: Date,
) =>
  prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });

export const findRefreshToken = (token: string) =>
  prisma.refreshToken.findUnique({
    where: { token },
    include: { user: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });

export const revokeRefreshToken = (token: string) =>
  prisma.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  });

export const revokeAllUserRefreshTokens = (userId: string) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

export const deleteExpiredRefreshTokens = () =>
  prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

// ---------------------------------------------------------------------------
// Role repository
// ---------------------------------------------------------------------------

export const findAllRoles = () =>
  prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: 'asc' },
  });

export const findRoleById = (id: string) =>
  prisma.role.findUnique({
    where: { id },
    include: { permissions: { include: { permission: true } } },
  });

export const findRoleByName = (name: string) =>
  prisma.role.findUnique({ where: { name } });

export const createRole = (data: CreateRoleInput) =>
  prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      ...(data.permissionIds?.length && {
        permissions: {
          create: data.permissionIds.map((permissionId) => ({ permissionId })),
        },
      }),
    },
    include: { permissions: { include: { permission: true } } },
  });

export const assignPermissionsToRole = (
  roleId: string,
  permissionIds: string[],
) =>
  prisma.$transaction(async (tx) => {
    // Delete existing mappings first (full replace)
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length === 0) return;
    await tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    });
  });

// ---------------------------------------------------------------------------
// Permission repository
// ---------------------------------------------------------------------------

export const findAllPermissions = () =>
  prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });

export const findPermissionsByIds = (ids: string[]) =>
  prisma.permission.findMany({ where: { id: { in: ids } } });

export const createPermission = (
  name: string,
  module: string,
  action: string,
  description?: string,
) => prisma.permission.create({ data: { name, module, action, description } });

export const seedDefaultPermissions = async () => {
  const defaults = [
    // Auth / Users
    { module: 'users',     action: 'create',  name: 'users:create',  description: 'Create users' },
    { module: 'users',     action: 'read',    name: 'users:read',    description: 'View users' },
    { module: 'users',     action: 'update',  name: 'users:update',  description: 'Update users' },
    { module: 'users',     action: 'delete',  name: 'users:delete',  description: 'Delete users' },
    { module: 'roles',     action: 'manage',  name: 'roles:manage',  description: 'Manage roles & permissions' },
    // Inventory
    { module: 'inventory', action: 'create',  name: 'inventory:create' },
    { module: 'inventory', action: 'read',    name: 'inventory:read' },
    { module: 'inventory', action: 'update',  name: 'inventory:update' },
    { module: 'inventory', action: 'delete',  name: 'inventory:delete' },
    // Sales
    { module: 'sales',     action: 'create',  name: 'sales:create' },
    { module: 'sales',     action: 'read',    name: 'sales:read' },
    { module: 'sales',     action: 'void',    name: 'sales:void' },
    // Repairs
    { module: 'repairs',   action: 'create',  name: 'repairs:create' },
    { module: 'repairs',   action: 'read',    name: 'repairs:read' },
    { module: 'repairs',   action: 'update',  name: 'repairs:update' },
    // Reports
    { module: 'reports',   action: 'read',    name: 'reports:read' },
    { module: 'reports',   action: 'export',  name: 'reports:export' },
    // Cash
    { module: 'cash',      action: 'manage',  name: 'cash:manage' },
    // Outlets
    { module: 'outlets',   action: 'manage',  name: 'outlets:manage' },
    // Transfers
    { module: 'transfers', action: 'create',  name: 'transfers:create' },
    { module: 'transfers', action: 'approve', name: 'transfers:approve' },
  ] as const;

  await prisma.$transaction(
    defaults.map((p) =>
      prisma.permission.upsert({
        where: { name: p.name },
        update: {},
        create: { ...p, description: 'description' in p ? p.description : undefined },
      }),
    ),
  );
};
