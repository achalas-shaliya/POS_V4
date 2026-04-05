import * as repo from './reports.repository';
import type {
  SalesSummaryInput,
  SalesByPeriodInput,
  TopItemsInput,
  RepairSummaryInput,
  RepairTurnaroundInput,
  InventorySnapshotInput,
  InventoryMovementsInput,
  CashSummaryInput,
  CashVarianceInput,
} from './reports.schema';

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const REPORT_CACHE_TTL_MS = 30_000;
const reportCache = new Map<string, CacheEntry<unknown>>();

const cacheKey = (scope: string, input: unknown) => `${scope}:${JSON.stringify(input)}`;

const withCache = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const cached = reportCache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await loader();
  reportCache.set(key, { data, expiresAt: now + REPORT_CACHE_TTL_MS });
  return data;
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export const getSalesSummary = (input: SalesSummaryInput) =>
  withCache(cacheKey('sales-summary', input), () => repo.getSalesSummary(input));

export const getSalesByPeriod = (input: SalesByPeriodInput) =>
  withCache(cacheKey('sales-by-period', input), () => repo.getSalesByPeriod(input));

export const getTopSellingItems = (input: TopItemsInput) =>
  withCache(cacheKey('sales-top-items', input), () => repo.getTopSellingItems(input));

// ---------------------------------------------------------------------------
// Repairs
// ---------------------------------------------------------------------------

export const getRepairSummary = (input: RepairSummaryInput) =>
  withCache(cacheKey('repairs-summary', input), () => repo.getRepairSummary(input));

export const getRepairTurnaround = (input: RepairTurnaroundInput) =>
  withCache(cacheKey('repairs-turnaround', input), () => repo.getRepairTurnaround(input));

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const getInventorySnapshot = (input: InventorySnapshotInput) =>
  withCache(cacheKey('inventory-snapshot', input), () => repo.getInventorySnapshot(input));

export const getInventoryMovements = async (input: InventoryMovementsInput) => {
  const { page, limit } = input;
  const [data, total] = await withCache(
    cacheKey('inventory-movements', input),
    () => repo.getInventoryMovements(input),
  );
  return { data, total, page, limit };
};

// ---------------------------------------------------------------------------
// Cash
// ---------------------------------------------------------------------------

export const getCashSummary = (input: CashSummaryInput) =>
  withCache(cacheKey('cash-summary', input), () => repo.getCashSummary(input));

export const getCashVariance = async (input: CashVarianceInput) => {
  const [data, total] = await withCache(
    cacheKey('cash-variance', input),
    () => repo.getCashVariance(input),
  );
  return { data, total, page: input.page, limit: input.limit };
};
