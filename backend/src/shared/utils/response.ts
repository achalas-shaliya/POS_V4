import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { ApiResponse, PaginationMeta } from '../types';

// ---------------------------------------------------------------------------
// Response helpers — keep controllers thin by standardising the JSON shape
// ---------------------------------------------------------------------------

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = StatusCodes.OK,
): Response<ApiResponse<T>> =>
  res.status(statusCode).json({ success: true, message, data });

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Created successfully',
): Response<ApiResponse<T>> =>
  sendSuccess(res, data, message, StatusCodes.CREATED);

export const sendNoContent = (res: Response): Response =>
  res.status(StatusCodes.NO_CONTENT).send();

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  meta: Omit<PaginationMeta, 'totalPages'>,
  message = 'Success',
): Response<ApiResponse<T[]>> =>
  res.status(StatusCodes.OK).json({
    success: true,
    message,
    data,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });
