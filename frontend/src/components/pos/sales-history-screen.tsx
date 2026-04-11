"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type OutletRecord, type SaleReceipt } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const money = (v: number | string) => `Rs. ${Number(v).toFixed(2)}`;

const DATE_FMT = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  VOIDED: "bg-rose-100 text-rose-700",
};

type SaleStatus = "COMPLETED" | "VOIDED";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SalesHistoryScreen() {
  const session = api.getSession();

  // filters
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [outletId, setOutletId] = useState("");
  const [status, setStatus] = useState<SaleStatus | "ALL">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  // data
  const [sales, setSales] = useState<SaleReceipt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaleReceipt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // void
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    void api.listOutlets().then((data) => setOutlets(data));
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof api.listSales>[0] = {
        page,
        limit: LIMIT,
        ...(outletId && { outletId }),
        ...(status !== "ALL" && { status }),
        ...(fromDate && { fromDate: new Date(fromDate).toISOString() }),
        ...(toDate && { toDate: new Date(`${toDate}T23:59:59`).toISOString() }),
      };
      const result = await api.listSales(params);
      setSales(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, [outletId, status, fromDate, toDate, page]);

  useEffect(() => { void loadSales(); }, [loadSales]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setVoidReason("");
    setVoidError(null);
    setDetailLoading(true);
    try {
      const data = await api.getSaleById(id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sale detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!detail || !voidReason.trim()) return;
    setVoiding(true);
    setVoidError(null);
    try {
      const updated = await api.voidSale(detail.id, { reason: voidReason.trim() });
      setDetail(updated);
      await loadSales();
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "Failed to void sale");
    } finally {
      setVoiding(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const canManage = session?.user?.permissions?.includes("sales:manage") ?? false;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative grid gap-5 md:h-full xl:grid-cols-[1.3fr_0.9fr] xl:items-stretch xl:overflow-hidden">
      {/* ── Left: list ── */}
      <section className="flex min-h-0 flex-col gap-4">
        {/* Toolbar */}
        <div className="card space-y-3 p-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Point of Sale</p>
            <h2 className="mt-0.5 text-lg font-bold">Sales History</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={outletId}
              onChange={(e) => { setOutletId(e.target.value); setPage(1); }}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none col-span-2 sm:col-span-1"
            >
              <option value="">All outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as SaleStatus | "ALL"); setPage(1); }}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="VOIDED">Voided</option>
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
              placeholder="From"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
              placeholder="To"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>
        )}

        {/* Table */}
        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading sales…</p>
          ) : sales.length === 0 ? (
            <p className="p-6 text-sm text-muted">No sales found for the selected filters.</p>
          ) : (
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-[0.12em] text-muted">
                    <th className="px-4 py-3">Receipt #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Outlet</th>
                    <th className="px-4 py-3">Cashier</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      onClick={() => openDetail(sale.id)}
                      className={`cursor-pointer transition hover:bg-surface ${selectedId === sale.id ? "bg-brand/5" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{sale.receiptNo}</td>
                      <td className="px-4 py-3 text-xs text-muted">{DATE_FMT(sale.createdAt)}</td>
                      <td className="px-4 py-3">{sale.outlet.name}</td>
                      <td className="px-4 py-3">{sale.cashier.fullName}</td>
                      <td className="px-4 py-3 text-muted">{sale.customer?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{money(sale.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[sale.status] ?? ""}`}>
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <p className="text-xs text-muted">
                Page {page} of {totalPages} · {total} sales
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Right: detail ── */}
      <aside>
        {selectedId ? (
          <div className="card space-y-4 p-5">
            {detailLoading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : detail ? (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted">{detail.receiptNo}</p>
                    <p className="mt-0.5 text-xs text-muted">{DATE_FMT(detail.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[detail.status] ?? ""}`}>
                    {detail.status}
                  </span>
                </div>

                {/* Meta */}
                <div className="rounded-2xl border border-line bg-surface p-3 space-y-1 text-xs">
                  <MetaRow label="Outlet" value={detail.outlet.name} />
                  <MetaRow label="Cashier" value={detail.cashier.fullName} />
                  {detail.customer && (
                    <MetaRow label="Customer" value={`${detail.customer.name} · ${detail.customer.phone}`} />
                  )}
                  {detail.note && <MetaRow label="Note" value={detail.note} />}
                </div>

                {/* Items */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">Items</p>
                  <div className="space-y-1.5">
                    {detail.items.map((line) => {
                      const lineTotal = Number(line.unitPrice) * line.quantity - Number(line.discount);
                      return (
                        <div key={line.id} className="flex justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium leading-snug">{line.item.name}</p>
                            <p className="text-xs text-muted">
                              {line.quantity} × {money(line.unitPrice)}
                              {Number(line.discount) > 0 && ` − ${money(line.discount)}`}
                            </p>
                          </div>
                          <p className="font-semibold">{money(lineTotal)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-2xl border border-line bg-surface p-3 space-y-1 text-xs">
                  <MetaRow label="Subtotal" value={money(detail.subtotal)} />
                  {Number(detail.discountAmt) > 0 && (
                    <MetaRow label="Discount" value={`− ${money(detail.discountAmt)}`} className="text-rose-600" />
                  )}
                  <div className="flex justify-between border-t border-line pt-1 text-sm font-bold text-ink">
                    <span>Total</span>
                    <span>{money(detail.total)}</span>
                  </div>
                </div>

                {/* Payments */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">Payments</p>
                  <div className="space-y-1">
                    {detail.payments.flatMap((pt) =>
                      pt.legs.map((leg, i) => (
                        <div key={`${pt.id}-${i}`} className="flex justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs">
                          <span className="font-medium">{leg.reference ? `${leg.method} (${leg.reference})` : leg.method}</span>
                          <span>{money(leg.amount)}</span>
                        </div>
                      )),
                    )}
                  </div>
                </div>

                {/* Void action — managers only, completed only */}
                {canManage && detail.status === "COMPLETED" && (
                  <div className="space-y-2 border-t border-line pt-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Void Sale</p>
                    <input
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Reason for voiding (required)"
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                    />
                    {voidError && <p className="text-xs text-rose-600">{voidError}</p>}
                    <button
                      type="button"
                      onClick={handleVoid}
                      disabled={voiding || !voidReason.trim()}
                      className="w-full rounded-2xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      {voiding ? "Voiding…" : "Void Sale"}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm text-muted">Click a sale row to view its details.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function MetaRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between gap-2 ${className ?? ""}`}>
      <span className="text-muted">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
