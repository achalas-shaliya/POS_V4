"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type SalesSummary,
  type SalesPeriodRow,
  type TopItemRow,
  type RepairSummary,
  type RepairTurnaroundRow,
  type InventorySnapshotItem,
  type InventorySnapshotTotals,
  type InventoryMovementRow,
  type CashSummary,
  type CashVarianceRow,
  type OutletRecord,
  type WarehouseRecord,
  type StockRow,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const money = (v: number | string | null | undefined) => `Rs. ${Number(v ?? 0).toFixed(2)}`;

const toISOFrom = (d: string) => (d ? `${d}T00:00:00.000Z` : undefined);
const toISOTo   = (d: string) => (d ? `${d}T23:59:59.999Z` : undefined);

const todayDate = () => new Date().toISOString().slice(0, 10);
const monthAgo  = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const REPAIR_STATUS_COLORS: Record<string, string> = {
  PENDING:       "bg-amber-100 text-amber-700",
  IN_PROGRESS:   "bg-sky-100 text-sky-700",
  WAITING_PARTS: "bg-purple-100 text-purple-700",
  COMPLETED:     "bg-emerald-100 text-emerald-700",
  DELIVERED:     "bg-teal-100 text-teal-700",
  CANCELLED:     "bg-rose-100 text-rose-700",
};

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  OPENING_FLOAT: "bg-sky-100 text-sky-700",
  SALE_CASH:     "bg-emerald-100 text-emerald-700",
  REPAIR_CASH:   "bg-emerald-100 text-emerald-700",
  CASH_IN:       "bg-brand/10 text-brand",
  CASH_OUT:      "bg-rose-100 text-rose-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  CASH:   "bg-emerald-100 text-emerald-700",
  CARD:   "bg-sky-100 text-sky-700",
  ONLINE: "bg-purple-100 text-purple-700",
};

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, onClick }: { label: string; value: string | number; sub?: string; onClick?: () => void }) {
  return (
    <div
      className={`rounded-[24px] border border-line bg-white p-5 ${
        onClick ? "cursor-pointer transition hover:border-brand hover:shadow-sm" : ""
      }`}
      onClick={onClick}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      {onClick && <p className="mt-2 text-xs font-medium text-brand">Click to filter ↓</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{children}</p>
  );
}

function DataTable({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-line">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-4 py-3 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range + outlet filter bar
// ---------------------------------------------------------------------------

function FilterBar({
  fromDate, toDate, outletId, outlets,
  onFrom, onTo, onOutlet, onApply,
}: {
  fromDate: string; toDate: string; outletId: string;
  outlets: OutletRecord[];
  onFrom: (v: string) => void; onTo: (v: string) => void;
  onOutlet: (v: string) => void; onApply: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[24px] border border-line bg-white px-5 py-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">From</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFrom(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onTo(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Outlet</label>
        <select
          value={outletId}
          onChange={(e) => onOutlet(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
        >
          <option value="">All outlets</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <button
        onClick={onApply}
        className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Apply
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Sales
// ---------------------------------------------------------------------------

function SalesTab({ from, to, outletId }: { from: string; to: string; outletId: string }) {
  const [summary,  setSummary]  = useState<SalesSummary | null>(null);
  const [period,   setPeriod]   = useState<SalesPeriodRow[]>([]);
  const [topItems, setTopItems] = useState<TopItemRow[]>([]);
  const [groupBy,  setGroupBy]  = useState<"day" | "week" | "month">("day");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {
        fromDate: toISOFrom(from),
        toDate:   toISOTo(to),
        outletId: outletId || undefined,
      };
      const [s, p, t] = await Promise.all([
        api.getSalesSummary(params),
        api.getSalesByPeriod({ ...params, groupBy }),
        api.getTopItems({ ...params, limit: 10 }),
      ]);
      setSummary(s); setPeriod(p); setTopItems(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, outletId, groupBy]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !summary) return <p className="py-8 text-center text-sm text-muted">Loading sales data…</p>;
  if (error) return <p className="text-sm font-medium text-rose-600">{error}</p>;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Sales"     value={summary?.totalSales ?? 0} />
        <KpiCard label="Total Revenue"   value={money(summary?.totalRevenue   ?? 0)} />
        <KpiCard label="Avg Order Value" value={money(summary?.avgOrderValue  ?? 0)} />
        <KpiCard label="Total Discounts" value={money(summary?.totalDiscounts ?? 0)} sub={`${summary?.voidedSales ?? 0} voided`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Payment method breakdown */}
        <div className="rounded-[28px] border border-line bg-white p-6">
          <SectionLabel>Breakdown</SectionLabel>
          <h3 className="mt-1 text-xl font-bold">By payment method</h3>
          {summary?.byPaymentMethod && summary.byPaymentMethod.length > 0 ? (
            <div className="mt-4 space-y-4">
              {summary.byPaymentMethod.map((pm) => {
                const pct = summary.totalRevenue > 0 ? (pm.total / summary.totalRevenue) * 100 : 0;
                return (
                  <div key={pm.method}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_COLORS[pm.method] ?? "bg-surface text-muted"}`}>
                          {pm.method}
                        </span>
                        <span className="text-xs text-muted">{pm.txCount} tx</span>
                      </div>
                      <span className="text-sm font-semibold">{money(pm.total)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct.toFixed(1)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4"><Empty text="No payment data in this period." /></div>
          )}
        </div>

        {/* Top selling items */}
        <div className="rounded-[28px] border border-line bg-white p-6">
          <SectionLabel>Top items</SectionLabel>
          <h3 className="mt-1 text-xl font-bold">Best sellers</h3>
          {topItems.length > 0 ? (
            <div className="mt-4">
              <DataTable cols={["Item", "Qty", "Revenue"]}>
                {topItems.map((r) => (
                  <tr key={r.itemId}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="font-mono text-xs text-muted">{r.sku}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.totalQty}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{money(r.totalRevenue)}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          ) : (
            <div className="mt-4"><Empty text="No items sold in this period." /></div>
          )}
        </div>
      </div>

      {/* Revenue trend */}
      <div className="rounded-[28px] border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Trend</SectionLabel>
            <h3 className="mt-1 text-xl font-bold">Revenue by period</h3>
          </div>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "day" | "week" | "month")}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
        <div className="mt-4">
          {period.length > 0 ? (
            <DataTable cols={["Period", "Revenue", "Discount", "Orders", "Avg Order"]}>
              {period.map((r) => (
                <tr key={r.period}>
                  <td className="px-4 py-3 font-medium">{r.period}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{money(r.revenue)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">{r.discount > 0 ? money(r.discount) : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">{r.orderCount}</td>
                  <td className="px-4 py-3">{money(r.avgOrder)}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <Empty text="No period data available." />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Repairs
// ---------------------------------------------------------------------------

function RepairsTab({ from, to, outletId }: { from: string; to: string; outletId: string }) {
  const [summary,    setSummary]    = useState<RepairSummary | null>(null);
  const [turnaround, setTurnaround] = useState<RepairTurnaroundRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {
        fromDate: toISOFrom(from),
        toDate:   toISOTo(to),
        outletId: outletId || undefined,
      };
      const [s, t] = await Promise.all([
        api.getRepairSummary(params),
        api.getRepairTurnaround(params),
      ]);
      setSummary(s); setTurnaround(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repair data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, outletId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !summary) return <p className="py-8 text-center text-sm text-muted">Loading repair data…</p>;
  if (error) return <p className="text-sm font-medium text-rose-600">{error}</p>;

  const totalJobs = summary?.byStatus.reduce((a, r) => a + r.count, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Jobs"     value={totalJobs} />
        <KpiCard label="Repair Revenue" value={money(summary?.totalRevenue   ?? 0)} />
        <KpiCard label="Parts Cost"     value={money(summary?.totalPartsCost ?? 0)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Jobs by status */}
        <div className="rounded-[28px] border border-line bg-white p-6">
          <SectionLabel>Overview</SectionLabel>
          <h3 className="mt-1 text-xl font-bold">Jobs by status</h3>
          {summary?.byStatus && summary.byStatus.length > 0 ? (
            <div className="mt-4 space-y-2">
              {summary.byStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${REPAIR_STATUS_COLORS[s.status] ?? "bg-surface text-muted"}`}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-xl font-bold">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4"><Empty text="No repair jobs in this period." /></div>
          )}
        </div>

        {/* Technician turnaround */}
        <div className="rounded-[28px] border border-line bg-white p-6">
          <SectionLabel>Performance</SectionLabel>
          <h3 className="mt-1 text-xl font-bold">Technician turnaround</h3>
          {turnaround.length > 0 ? (
            <div className="mt-4">
              <DataTable cols={["Technician", "Completed", "Avg Hours"]}>
                {turnaround.map((r, i) => (
                  <tr key={r.technicianId ?? i}>
                    <td className="px-4 py-3 font-medium">{r.technicianName ?? "Unassigned"}</td>
                    <td className="px-4 py-3">{r.jobCount}</td>
                    <td className="px-4 py-3">{r.avgHours !== null ? `${Number(r.avgHours).toFixed(1)}h` : "—"}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          ) : (
            <div className="mt-4"><Empty text="No completed jobs in this period." /></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Inventory
// ---------------------------------------------------------------------------

type LocationScope = "all" | "outlets" | "warehouses";

function InventoryTab({ outletId: appliedOutletId }: { outletId: string }) {
  const [snapshot,            setSnapshot]            = useState<InventorySnapshotItem[] | InventorySnapshotTotals | null>(null);
  const [movements,           setMovements]           = useState<InventoryMovementRow[]>([]);
  const [movTotal,            setMovTotal]            = useState(0);
  const [movPage,             setMovPage]             = useState(1);
  const [outlets,             setOutlets]             = useState<OutletRecord[]>([]);
  const [warehouses,          setWarehouses]          = useState<WarehouseRecord[]>([]);
  const [lowStockOnly,        setLowStockOnly]        = useState(false);
  const [scope,               setScope]               = useState<LocationScope>("all");
  // "" = All Outlets / All Warehouses; a UUID = specific location
  const [selectedOutletId,    setSelectedOutletId]    = useState(appliedOutletId);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [loading,             setLoading]             = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const MOV_PAGE_SIZE = 20;

  // Load outlets + warehouses once
  useEffect(() => {
    api.listOutlets().then((ol) => {
      setOutlets(ol);
      setSelectedOutletId(appliedOutletId); // keep parent filter if set
    }).catch(() => null);
    api.listWarehouses().then((wh) => {
      setWarehouses(wh);
    }).catch(() => null);
  }, [appliedOutletId]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // lowStockOnly=false must be omitted — buildQuery sends "false" as a string,
      // and Zod z.coerce.boolean() coerces any non-empty string to true.
      const lowStockParam = lowStockOnly ? true : undefined;

      if (scope === "all") {
        // Aggregate totals — shows KPI cards
        const snap = await api.getInventorySnapshot({ lowStockOnly: lowStockParam });
        setSnapshot(snap);
        return;
      }

      // outlets or warehouses — fetch each location in parallel and merge
      const ids =
        scope === "outlets"
          ? (selectedOutletId ? [selectedOutletId] : outlets.map((o) => o.id))
          : (selectedWarehouseId ? [selectedWarehouseId] : warehouses.map((w) => w.id));

      if (ids.length === 0) {
        // Locations not loaded yet or none exist — wait for them to load
        setSnapshot([]);
        return;
      }

      const snapshotsRaw = await Promise.all(
        ids.map((id) =>
          api.getInventorySnapshot({
            outletId:    scope === "outlets"    ? id : undefined,
            warehouseId: scope === "warehouses" ? id : undefined,
            lowStockOnly: lowStockParam,
          }).then((r) => r as InventorySnapshotItem[])
        )
      );

      setSnapshot(snapshotsRaw.flat());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId, selectedWarehouseId, scope, lowStockOnly, outlets, warehouses]);

  useEffect(() => { void load(); }, [load]);

  const loadMovements = useCallback(async () => {
    try {
      const mov = await api.getInventoryMovements({ page: movPage, limit: MOV_PAGE_SIZE });
      setMovements(mov.data);
      setMovTotal(mov.total);
    } catch {
      // non-critical — ignore movement errors
    }
  }, [movPage, MOV_PAGE_SIZE]);

  useEffect(() => { void loadMovements(); }, [loadMovements]);

  const isArray  = Array.isArray(snapshot);
  const isTotals = snapshot && !isArray && "outlets" in snapshot;
  const totals   = isTotals ? (snapshot as InventorySnapshotTotals) : null;
  const items    = isArray  ? (snapshot as InventorySnapshotItem[]) : [];

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  // Reset page whenever filters or scope change
  useEffect(() => { setPage(1); }, [scope, selectedOutletId, selectedWarehouseId, lowStockOnly]);

  const lowCount   = items.filter((r) => r.isLowStock).length;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems  = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Group page items by location for display
  const grouped = pageItems.reduce<Record<string, InventorySnapshotItem[]>>((acc, r) => {
    const key = `${r.location.type}::${r.location.id}::${r.location.name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  if (loading && !snapshot) return <p className="py-8 text-center text-sm text-muted">Loading inventory data…</p>;
  if (error) return <p className="text-sm font-medium text-rose-600">{error}</p>;

  return (
    <div className="space-y-5">
      {/* Totals KPIs */}
      {totals && (
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Outlet SKUs"         value={totals.outlets.totalItems} />
          <KpiCard label="Outlet Stock Value"  value={money(totals.outlets.totalStockValue)} />
          <KpiCard
            label="Outlet Low-Stock"
            value={totals.outlets.lowStockCount}
            sub={totals.outlets.lowStockCount > 0 ? "Items below minimum" : undefined}
            onClick={totals.outlets.lowStockCount > 0 ? () => { setScope("outlets"); setLowStockOnly(true); } : undefined}
          />
          <KpiCard label="Warehouse SKUs"      value={totals.warehouses.totalItems} />
          <KpiCard label="Warehouse Value"     value={money(totals.warehouses.totalStockValue)} />
          <KpiCard
            label="Warehouse Low-Stock"
            value={totals.warehouses.lowStockCount}
            sub={totals.warehouses.lowStockCount > 0 ? "Items below minimum" : undefined}
            onClick={totals.warehouses.lowStockCount > 0 ? () => { setScope("warehouses"); setLowStockOnly(true); } : undefined}
          />
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-line bg-white px-5 py-4">
        {/* Scope selector */}
        <div className="flex rounded-xl border border-line bg-surface p-0.5 gap-0.5">
          {(["all", "outlets", "warehouses"] as LocationScope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                scope === s ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {s === "all" ? "All locations" : s}
            </button>
          ))}
        </div>

        {/* Outlet picker — only when scope = outlets */}
        {scope === "outlets" && outlets.length > 0 && (
          <select
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
          >
            <option value="">All Outlets</option>
            {outlets.map((ol) => (
              <option key={ol.id} value={ol.id}>{ol.name}</option>
            ))}
          </select>
        )}

        {/* Warehouse picker — only when scope = warehouses */}
        {scope === "warehouses" && warehouses.length > 0 && (
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        )}

        {/* Low-stock toggle */}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded"
          />
          Low stock only
          {lowStockOnly && lowCount > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
              {lowCount}
            </span>
          )}
        </label>
      </div>

      {/* Per-item snapshot grouped by location */}
      {isArray && (
        <div className="rounded-[28px] border border-line bg-white p-6">
          <SectionLabel>Stock snapshot</SectionLabel>
          <div className="mt-1 text-xl font-bold">
            {scope === "outlets"    ? "Outlet stock levels"    :
             scope === "warehouses" ? "Warehouse stock levels" :
             "All location stock levels"}
            {items.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                ({items.length} item{items.length !== 1 ? "s" : ""})
              </span>
            )}
          </div>
          <div className="mt-4">
            {items.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-[20px] border border-line">
                  {/* Fixed-height scrollable body */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-line text-sm">
                      <thead className="sticky top-0 z-10 bg-surface text-left text-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">SKU</th>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Qty</th>
                          <th className="px-4 py-3 font-medium">Min</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Stock Value</th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="max-h-[440px] overflow-y-auto overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <tbody className="divide-y divide-line bg-white">
                        {Object.entries(grouped).map(([key, rows]) => {
                          const [locType, , locName] = key.split("::");
                          return (
                            <>
                              <tr key={`hdr-${key}`} className="bg-surface">
                                <td colSpan={6} className="px-4 py-2">
                                  <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${locType === "OUTLET" ? "bg-sky-100 text-sky-700" : "bg-purple-100 text-purple-700"}`}>
                                    {locType === "OUTLET" ? "Outlet" : "Warehouse"}
                                  </span>
                                  <span className="font-semibold text-ink">{locName}</span>
                                  <span className="ml-2 text-xs text-muted">
                                    {rows.filter((r) => r.isLowStock).length > 0
                                      ? `${rows.filter((r) => r.isLowStock).length} low-stock items`
                                      : `${rows.length} items`}
                                  </span>
                                </td>
                              </tr>
                              {rows.map((r) => (
                                <tr key={`${r.itemId}-${r.location.id}`} className={r.isLowStock ? "bg-rose-50/40" : ""}>
                                  <td className="w-32 px-4 py-3 font-mono text-xs">{r.sku}</td>
                                  <td className="px-4 py-3 font-medium">{r.name}</td>
                                  <td className={`w-20 px-4 py-3 font-semibold ${r.isLowStock ? "text-rose-600" : ""}`}>{r.quantity}</td>
                                  <td className="w-20 px-4 py-3 text-muted">{r.minQuantity}</td>
                                  <td className="w-24 px-4 py-3">
                                    {r.isLowStock
                                      ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">Low</span>
                                      : <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">OK</span>
                                    }
                                  </td>
                                  <td className="w-32 px-4 py-3 font-semibold text-emerald-700">{money(r.stockValue)}</td>
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <p className="text-muted">
                      Page {page} of {totalPages} &middot; showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} of {items.length}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-surface disabled:opacity-40"
                      >
                        ← Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-surface disabled:opacity-40"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Empty text={lowStockOnly ? "No low-stock items found." : "No items found."} />
            )}
          </div>
        </div>
      )}

      {/* Recent movements */}
      <div className="rounded-[28px] border border-line bg-white p-6">
        <SectionLabel>Activity</SectionLabel>
        <div className="flex items-baseline justify-between">
          <h3 className="mt-1 text-xl font-bold">
            Stock movements
            {movTotal > 0 && (
              <span className="ml-2 text-sm font-normal text-muted">({movTotal})</span>
            )}
          </h3>
        </div>
        <div className="mt-4">
          {movements.length > 0 ? (
            <>
              {/* Scrollable table */}
              <div className="overflow-hidden rounded-[20px] border border-line">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="sticky top-0 z-10 bg-surface text-left text-muted">
                      <tr>
                        {["Date", "Type", "Item", "Qty", "By"].map((c) => (
                          <th key={c} className="px-4 py-3 font-medium">{c}</th>
                        ))}
                      </tr>
                    </thead>
                  </table>
                </div>
                <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <tbody className="divide-y divide-line bg-white">
                      {movements.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 text-muted">{new Date(r.createdAt).toLocaleDateString("en-LK")}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                              {r.movementType}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{r.item.name}</td>
                          <td className="px-4 py-3 font-semibold">{r.quantity}</td>
                          <td className="px-4 py-3 text-muted">{r.createdByUser?.fullName ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination controls */}
              {movTotal > MOV_PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <p className="text-muted">
                    Page {movPage} of {Math.ceil(movTotal / MOV_PAGE_SIZE)} &middot; showing {(movPage - 1) * MOV_PAGE_SIZE + 1}–{Math.min(movPage * MOV_PAGE_SIZE, movTotal)} of {movTotal}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                      disabled={movPage === 1}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-surface disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovPage((p) => Math.min(Math.ceil(movTotal / MOV_PAGE_SIZE), p + 1))}
                      disabled={movPage === Math.ceil(movTotal / MOV_PAGE_SIZE)}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-surface disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Empty text="No movements found." />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Cash
// ---------------------------------------------------------------------------

function CashTab({ from, to, outletId }: { from: string; to: string; outletId: string }) {
  const [summary,  setSummary]  = useState<CashSummary | null>(null);
  const [variance, setVariance] = useState<CashVarianceRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {
        fromDate: toISOFrom(from),
        toDate:   toISOTo(to),
        outletId: outletId || undefined,
      };
      const [s, v] = await Promise.all([
        api.getCashSummary(params),
        api.getCashVariance({ ...params, limit: 20 }),
      ]);
      setSummary(s); setVariance(v.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cash data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, outletId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !summary) return <p className="py-8 text-center text-sm text-muted">Loading cash data…</p>;
  if (error) return <p className="text-sm font-medium text-rose-600">{error}</p>;

  const diff = summary?.totalDifference ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sessions"      value={summary?.registerCount ?? 0} />
        <KpiCard label="Expected Cash" value={money(summary?.totalExpected ?? 0)} />
        <KpiCard label="Actual Cash"   value={money(summary?.totalActual   ?? 0)} />
        <KpiCard
          label="Net Variance"
          value={`${diff >= 0 ? "+" : ""}${money(diff)}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Movement type breakdown */}
        <div className="rounded-[28px] border border-line bg-white p-6">
          <SectionLabel>Breakdown</SectionLabel>
          <h3 className="mt-1 text-xl font-bold">By movement type</h3>
          {summary?.byMovementType && summary.byMovementType.length > 0 ? (
            <div className="mt-4 space-y-2">
              {summary.byMovementType.map((r) => (
                <div key={r.type} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MOVEMENT_TYPE_COLORS[r.type] ?? "bg-surface text-muted"}`}>
                    {r.type.replace(/_/g, " ")}
                  </span>
                  <div className="text-right">
                    <p className="font-semibold">{money(r.total)}</p>
                    <p className="text-xs text-muted">{r.count} movements</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4"><Empty text="No movement data in this period." /></div>
          )}
        </div>

        {/* Closed sessions variance */}
        <div className="rounded-[28px] border border-line bg-white p-6">
          <SectionLabel>Sessions</SectionLabel>
          <h3 className="mt-1 text-xl font-bold">Closed register sessions</h3>
          {variance.length > 0 ? (
            <div className="mt-4">
              <DataTable cols={["Date", "Outlet", "Cashier", "Expected", "Actual", "Variance"]}>
                {variance.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-muted">{new Date(r.openedAt).toLocaleDateString("en-LK")}</td>
                    <td className="px-4 py-3 font-medium">{r.outlet?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{r.openedBy?.fullName ?? "—"}</td>
                    <td className="px-4 py-3">{money(r.expectedCash)}</td>
                    <td className="px-4 py-3">{money(r.actualCash)}</td>
                    <td className={`px-4 py-3 font-semibold ${r.difference < 0 ? "text-rose-600" : r.difference > 0 ? "text-emerald-700" : "text-muted"}`}>
                      {r.difference >= 0 ? "+" : ""}{money(r.difference)}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          ) : (
            <div className="mt-4"><Empty text="No closed sessions in this period." /></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Warehouse Health
// ---------------------------------------------------------------------------

type WarehouseSummary = {
  id: string; name: string;
  totalItems: number; lowStockItems: number;
  totalQuantity: number; utilizationPct: number;
};

function buildWarehouseSummaries(warehouses: WarehouseRecord[], stock: StockRow[]): WarehouseSummary[] {
  return warehouses.map((wh) => {
    const rows = stock.filter((s) => s.warehouse?.id === wh.id);
    const totalQuantity  = rows.reduce((sum, r) => sum + r.quantity, 0);
    const utilizationPct = Math.min(95, Math.max(5, Math.round(totalQuantity / 20)));
    return {
      id: wh.id, name: wh.name,
      totalItems:    rows.length,
      lowStockItems: rows.filter((r) => r.quantity <= r.minQuantity).length,
      totalQuantity,
      utilizationPct,
    };
  });
}

function WarehouseHealthTab() {
  const [summaries, setSummaries] = useState<WarehouseSummary[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const warehouses = await api.listWarehouses();
        const stockResponses = await Promise.all(
          warehouses.map((wh) => api.getWarehouseStock(wh.id, { page: 1, limit: 500 }).then((r) => r.data)),
        );
        const allStock: StockRow[] = stockResponses.flatMap((rows, i) =>
          rows.map((r) => ({ ...r, warehouse: { id: warehouses[i]!.id, name: warehouses[i]!.name } })),
        );
        setSummaries(buildWarehouseSummaries(warehouses, allStock));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load warehouse data");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading)           return <p className="py-8 text-center text-sm text-muted">Loading warehouse data…</p>;
  if (error)             return <p className="text-sm font-medium text-rose-600">{error}</p>;
  if (!summaries.length) return <Empty text="No warehouses found." />;

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {summaries.map((wh) => (
        <div key={wh.id} className="rounded-[28px] border border-line bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Warehouse</p>
              <h4 className="mt-1 text-xl font-bold">{wh.name}</h4>
              <p className="mt-1 text-sm text-muted">{wh.totalQuantity} total units</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${wh.lowStockItems > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {wh.lowStockItems > 0 ? `${wh.lowStockItems} low` : "Healthy"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-xs text-muted">Total SKUs</p>
              <p className="mt-1 text-2xl font-bold">{wh.totalItems}</p>
            </div>
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-xs text-muted">Low stock</p>
              <p className={`mt-1 text-2xl font-bold ${wh.lowStockItems > 0 ? "text-rose-600" : ""}`}>
                {wh.lowStockItems}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
              <span>Utilization estimate</span>
              <span>{wh.utilizationPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${wh.utilizationPct}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

type TabId = "sales" | "repairs" | "inventory" | "cash" | "warehouse";

const TABS: { id: TabId; label: string }[] = [
  { id: "sales",     label: "Sales"     },
  { id: "repairs",   label: "Repairs"   },
  { id: "inventory", label: "Inventory" },
  { id: "cash",      label: "Cash"      },
  { id: "warehouse", label: "Warehouse" },
];

export default function ReportsScreen() {
  const [activeTab, setActiveTab] = useState<TabId>("sales");
  const [fromDate,  setFromDate]  = useState(monthAgo());
  const [toDate,    setToDate]    = useState(todayDate());
  const [outletId,  setOutletId]  = useState("");
  const [outlets,   setOutlets]   = useState<OutletRecord[]>([]);

  // Applied filter — only updates on "Apply"
  const [appliedFrom,   setAppliedFrom]   = useState(fromDate);
  const [appliedTo,     setAppliedTo]     = useState(toDate);
  const [appliedOutlet, setAppliedOutlet] = useState(outletId);
  const [filterKey,     setFilterKey]     = useState(0);

  useEffect(() => { api.listOutlets().then(setOutlets).catch(() => null); }, []);

  const handleApply = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedOutlet(outletId);
    setFilterKey((n) => n + 1);
  };

  return (
    <div className="space-y-5 xl:h-[calc(100vh-6rem)] xl:flex xl:flex-col">

      {/* Filter bar + tab selector row */}
      <div className="flex flex-col gap-4 xl:shrink-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <FilterBar
            fromDate={fromDate} toDate={toDate} outletId={outletId} outlets={outlets}
            onFrom={setFromDate} onTo={setToDate} onOutlet={setOutletId} onApply={handleApply}
          />
          {/* Tab pill bar */}
          <div className="flex rounded-2xl border border-line bg-surface p-1 gap-1 self-end shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === t.id ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div key={`${activeTab}-${filterKey}`} className="xl:flex-1 xl:overflow-y-auto">
        {activeTab === "sales"     && <SalesTab     from={appliedFrom} to={appliedTo} outletId={appliedOutlet} />}
        {activeTab === "repairs"   && <RepairsTab   from={appliedFrom} to={appliedTo} outletId={appliedOutlet} />}
        {activeTab === "inventory" && <InventoryTab outletId={appliedOutlet} />}
        {activeTab === "cash"      && <CashTab      from={appliedFrom} to={appliedTo} outletId={appliedOutlet} />}
        {activeTab === "warehouse" && <WarehouseHealthTab />}
      </div>
    </div>
  );
}