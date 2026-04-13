"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  api,
  type SalesSummary,
  type RepairSummary,
  type InventorySnapshotTotals,
  type CashSummary,
  type TopItemRow,
} from "@/lib/api";
import { subscribeRepairRealtime } from "@/lib/realtime";

const money = (v: number) => `Rs. ${v.toFixed(2)}`;

// Backend requires ISO 8601 datetime with offset
const todayFrom = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString(); // e.g. "2026-04-05T00:00:00.000Z"
};
const todayTo = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const REPAIR_STATUS_COLORS: Record<string, string> = {
  PENDING:       "bg-amber-100 text-amber-700",
  IN_PROGRESS:   "bg-sky-100 text-sky-700",
  WAITING_PARTS: "bg-purple-100 text-purple-700",
  COMPLETED:     "bg-emerald-100 text-emerald-700",
  DELIVERED:     "bg-teal-100 text-teal-700",
  CANCELLED:     "bg-rose-100 text-rose-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  CASH:   "bg-emerald-100 text-emerald-700",
  CARD:   "bg-sky-100 text-sky-700",
  ONLINE: "bg-purple-100 text-purple-700",
};

const QUICK_NAV = [
  { href: "/dashboard/sales",     label: "POS",       icon: "🛒" },
  { href: "/dashboard/repairs",   label: "Repairs",   icon: "🔧" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "📦" },
  { href: "/dashboard/transfers", label: "Transfers", icon: "🔄" },
  { href: "/dashboard/cash",      label: "Cash",      icon: "💵" },
  { href: "/dashboard/reports",   label: "Reports",   icon: "📊" },
];

const OVERVIEW_REFRESH_MS = 10000;

function greeting(name: string) {
  const h = new Date().getHours();
  const salut = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${salut}, ${name}`;
}

export function OverviewScreen() {
  const { user } = useAuth();

  const [sales, setSales]         = useState<SalesSummary | null>(null);
  const [repairs, setRepairs]     = useState<RepairSummary | null>(null);
  const [inventory, setInventory] = useState<InventorySnapshotTotals | null>(null);
  const [cash, setCash]           = useState<CashSummary | null>(null);
  const [topItems, setTopItems]   = useState<TopItemRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const from = todayFrom();
    const to   = todayTo();

    const load = async (silent = false) => {
      if (!silent) setLoading(true);

      try {
        const [salesData, repairsData, inventoryData, cashData, topData] = await Promise.all([
          api.getSalesSummary({ fromDate: from, toDate: to }),
          api.getRepairSummary({}),
          api.getInventorySnapshot({}),
          api.getCashSummary({ fromDate: from, toDate: to }),
          api.getTopItems({ fromDate: from, toDate: to, limit: 5 }),
        ]);

        if (!active) return;
        setSales(salesData);
        setRepairs(repairsData);
        if ("outlets" in inventoryData) setInventory(inventoryData as InventorySnapshotTotals);
        setCash(cashData);
        setTopItems(topData);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load overview");
      } finally {
        if (!silent && active) setLoading(false);
      }
    };

    void load();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load(true);
    }, OVERVIEW_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeRepairRealtime(async () => {
      if (document.visibilityState !== "visible") return;

      const from = todayFrom();
      const to = todayTo();

      try {
        const [salesData, repairsData, inventoryData, cashData, topData] = await Promise.all([
          api.getSalesSummary({ fromDate: from, toDate: to }),
          api.getRepairSummary({}),
          api.getInventorySnapshot({}),
          api.getCashSummary({ fromDate: from, toDate: to }),
          api.getTopItems({ fromDate: from, toDate: to, limit: 5 }),
        ]);

        setSales(salesData);
        setRepairs(repairsData);
        if ("outlets" in inventoryData) setInventory(inventoryData as InventorySnapshotTotals);
        setCash(cashData);
        setTopItems(topData);
        setError(null);
      } catch {
        // Keep existing dashboard values on transient websocket refresh errors.
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const openRepairs = repairs?.byStatus
    .filter((s) => !["COMPLETED", "DELIVERED", "CANCELLED"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0) ?? 0;

  const lowStockTotal =
    (inventory?.outlets.lowStockCount ?? 0) + (inventory?.warehouses.lowStockCount ?? 0);

  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-5">

      {/* ── Greeting row ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Dashboard</p>
          <h2 className="mt-1 text-2xl font-bold">{greeting(firstName)} 👋</h2>
        </div>
        <p className="text-sm text-muted">
          {new Date().toLocaleDateString("en-LK", {
            weekday: "long",
            year:    "numeric",
            month:   "long",
            day:     "numeric",
          })}
        </p>
      </div>

      {loading && <p className="text-sm text-muted">Loading overview…</p>}
      {error   && <p className="text-sm font-medium text-rose-600">{error}</p>}

      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* Today's Revenue */}
        <div className="rounded-[24px] border border-line bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Today's Revenue</p>
          <p className="mt-2 text-2xl font-bold">{money(sales?.totalRevenue ?? 0)}</p>
          <p className="mt-1 text-xs text-muted">{sales?.totalSales ?? 0} sales</p>
        </div>

        {/* Avg order value */}
        <div className="rounded-[24px] border border-line bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Avg Order Value</p>
          <p className="mt-2 text-2xl font-bold">{money(sales?.avgOrderValue ?? 0)}</p>
          <p className="mt-1 text-xs text-muted">{sales?.voidedSales ?? 0} voided</p>
        </div>

        {/* Open repairs */}
        <div className="rounded-[24px] border border-line bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Open Repairs</p>
          <p className="mt-2 text-2xl font-bold">{openRepairs}</p>
          <p className="mt-1 text-xs text-muted">active jobs</p>
        </div>

        {/* Low stock */}
        <div
          className={`rounded-[24px] border p-5 ${
            lowStockTotal > 0
              ? "border-amber-200 bg-amber-50"
              : "border-line bg-white"
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              lowStockTotal > 0 ? "text-amber-700" : "text-muted"
            }`}
          >
            Low Stock
          </p>
          <p
            className={`mt-2 text-2xl font-bold ${
              lowStockTotal > 0 ? "text-amber-800" : ""
            }`}
          >
            {lowStockTotal}
          </p>
          <p
            className={`mt-1 text-xs ${
              lowStockTotal > 0 ? "text-amber-600" : "text-muted"
            }`}
          >
            lines below minimum
          </p>
        </div>

        {/* Cash expected */}
        <div className="rounded-[24px] border border-line bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Cash Expected</p>
          <p className="mt-2 text-2xl font-bold">{money(cash?.totalExpected ?? 0)}</p>
          <p className="mt-1 text-xs text-muted">{cash?.registerCount ?? 0} register(s) today</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">

        {/* Left column */}
        <div className="space-y-5">

          {/* Sales by payment method */}
          <div className="rounded-[28px] border border-line bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Breakdown</p>
            <h3 className="mt-1 text-xl font-bold">Sales by payment method</h3>
            {sales?.byPaymentMethod && sales.byPaymentMethod.length > 0 ? (
              <div className="mt-4 space-y-4">
                {sales.byPaymentMethod.map((pm) => {
                  const pct =
                    sales.totalRevenue > 0
                      ? (pm.total / sales.totalRevenue) * 100
                      : 0;
                  return (
                    <div key={pm.method}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              PAYMENT_COLORS[pm.method] ?? "bg-surface text-muted"
                            }`}
                          >
                            {pm.method}
                          </span>
                          <span className="text-xs text-muted">{pm.txCount} tx</span>
                        </div>
                        <span className="text-sm font-semibold">{money(pm.total)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No sales recorded today.</p>
            )}
          </div>

          {/* Top selling items */}
          <div className="rounded-[28px] border border-line bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Today</p>
            <h3 className="mt-1 text-xl font-bold">Top selling items</h3>
            {topItems.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-[20px] border border-line">
                <table className="min-w-full divide-y divide-line text-sm">
                  <thead className="bg-surface text-left text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-white">
                    {topItems.map((item) => (
                      <tr key={item.itemId}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{item.name}</p>
                          <p className="font-mono text-xs text-muted">{item.sku}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold">{item.totalQty}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">
                          {money(item.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No items sold today.</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Repair jobs by status */}
          <div className="rounded-[28px] border border-line bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Live</p>
            <h3 className="mt-1 text-xl font-bold">Repair jobs</h3>
            {repairs?.byStatus && repairs.byStatus.length > 0 ? (
              <div className="mt-4 space-y-2">
                {repairs.byStatus.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3"
                  >
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        REPAIR_STATUS_COLORS[s.status] ?? "bg-surface text-muted"
                      }`}
                    >
                      {s.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xl font-bold">{s.count}</span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between rounded-2xl border border-line px-4 py-3">
                  <span className="text-sm font-semibold text-muted">Repair revenue</span>
                  <span className="font-bold text-emerald-700">{money(repairs.totalRevenue)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No repair jobs found.</p>
            )}
          </div>

          {/* Quick navigation */}
          <div className="rounded-[28px] border border-line bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Shortcuts</p>
            <h3 className="mt-1 text-xl font-bold">Quick access</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {QUICK_NAV.map((nav) => (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-3 text-sm font-semibold text-ink transition hover:border-brand/30 hover:bg-brand/5 hover:text-brand"
                >
                  <span>{nav.icon}</span>
                  {nav.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
