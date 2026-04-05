import { z } from 'zod';

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ---------------------------------------------------------------------------
// Refresh token
// ---------------------------------------------------------------------------
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ---------------------------------------------------------------------------
// Create user (admin action)
// ---------------------------------------------------------------------------
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string().min(2).max(100),
  phone: z.string().max(20).optional(),
  roleId: z.string().uuid('Invalid role ID'),
});

// ---------------------------------------------------------------------------
// Update user (admin)
// ---------------------------------------------------------------------------
export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Change own password
// ---------------------------------------------------------------------------
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ---------------------------------------------------------------------------
// Create role
// ---------------------------------------------------------------------------
export const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

// ---------------------------------------------------------------------------
// Assign permissions to role
// ---------------------------------------------------------------------------
export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()).min(1),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>;
