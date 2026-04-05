import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

// ---------------------------------------------------------------------------
// AppError — throw this from controllers/services for predictable HTTP errors
// ---------------------------------------------------------------------------
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = StatusCodes.BAD_REQUEST,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Convenience factory helpers
export const notFound = (resource = 'Resource') =>
  new AppError(`${resource} not found`, StatusCodes.NOT_FOUND);

export const forbidden = (msg = 'Access denied') =>
  new AppError(msg, StatusCodes.FORBIDDEN);

export const unauthorized = (msg = 'Unauthorized') =>
  new AppError(msg, StatusCodes.UNAUTHORIZED);

export const conflict = (msg: string) =>
  new AppError(msg, StatusCodes.CONFLICT);

// ---------------------------------------------------------------------------
// Prisma error duck-typing helpers
// (avoids importing from generated client which may not exist yet)
// ---------------------------------------------------------------------------
function isPrismaKnownError(
  err: unknown,
): err is { code: string; meta?: Record<string, unknown>; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'clientVersion' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

function isPrismaValidationError(
  err: unknown,
): err is { message: string; clientVersion: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'clientVersion' in err &&
    err instanceof Error &&
    err.constructor.name === 'PrismaClientValidationError'
  );
}

// ---------------------------------------------------------------------------
// Global error-handling middleware
// ---------------------------------------------------------------------------
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // 1. Zod validation errors
  if (err instanceof ZodError) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // 2. App operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // 3. Prisma client known errors
  if (isPrismaKnownError(err)) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        res.status(StatusCodes.CONFLICT).json({
          success: false,
          message: 'A record with this value already exists',
          field: err.meta?.target,
        });
        return;
      case 'P2025': // Record not found
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Record not found',
        });
        return;
      case 'P2003': // Foreign key constraint
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Related record not found',
          field: err.meta?.field_name,
        });
        return;
      case 'P2014': // Relation violation
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'This operation would violate a required relation',
        });
        return;
    }
  }

  // 4. Prisma validation errors
  if (isPrismaValidationError(err)) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid query parameters',
    });
    return;
  }

  // 5. Unhandled / unknown errors
  const message =
    err instanceof Error ? err.message : 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled error:', err);
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
  });
};
