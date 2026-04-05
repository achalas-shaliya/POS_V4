import { z } from 'zod';
import type { FindManyOptions } from '../types';

// ---------------------------------------------------------------------------
// Reusable Zod schema for list/paginate query params
// ---------------------------------------------------------------------------
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ---------------------------------------------------------------------------
// Convert validated query params into Prisma skip/take values
// ---------------------------------------------------------------------------
export const getPaginationArgs = (
  input: PaginationInput,
): Pick<FindManyOptions, 'skip' | 'take' | 'sortBy' | 'sortOrder' | 'search'> => {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  return {
    skip: (page - 1) * limit,
    take: limit,
    search: input.search,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder ?? 'desc',
  };
};
