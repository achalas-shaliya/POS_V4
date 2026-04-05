import { Request } from 'express';

// ---------------------------------------------------------------------------
// JWT payload shape (mirrors what we sign in auth.service)
// ---------------------------------------------------------------------------
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

// ---------------------------------------------------------------------------
// Authenticated request — extended after JWT middleware adds user payload
// ---------------------------------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    outletId?: string;
  };
}

// ---------------------------------------------------------------------------
// Standard API response envelope
// ---------------------------------------------------------------------------
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: { field: string; message: string }[];
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Shared query params for list endpoints
// ---------------------------------------------------------------------------
export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Repository layer base types
// ---------------------------------------------------------------------------
export interface FindManyOptions {
  skip: number;
  take: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface FindManyResult<T> {
  data: T[];
  total: number;
}
