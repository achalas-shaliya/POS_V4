"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type ReturnDetail,
  type ReturnReason,
  type ReturnStatus,
  type ReturnSummary,
  type SaleReceipt,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const money = (v: number | string) => `Rs. ${Number(v).toFixed(2)}`;

const REASON_LABELS: Record<ReturnReason, string> = {
  DEFECTIVE: "Defective / Warranty Claim",
  WRONG_ITEM: "Wrong Item",
  CUSTOMER_CHANGE_MIND: "Customer Changed Mind",
  DAMAGED_IN_TRANSIT: "Damaged in Transit",
  OTHER: "Other",
};

const STATUS_STYLES: Record<ReturnStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const DATE_FMT = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ReturnsScreen() {
  const session = api.getSession();

  // list
  const [returns, setReturns] = useState<ReturnSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReturnDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // new return panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [receiptQuery, setReceiptQuery] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleReceipt | null>(null);
  const [selectedLines, setSelectedLines] = useState<Record<string, number>>({}); // saleItemId → qty
  const [reason, setReason] = useState<ReturnReason>("DEFECTIVE");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // approve / reject note
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Load list
  // ---------------------------------------------------------------------------
  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listReturns({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 100,
      });
      setReturns(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void loadReturns(); }, [loadReturns]);

  // ---------------------------------------------------------------------------
  // Load detail
  // ---------------------------------------------------------------------------
  const openDetail = async (id: string) => {
    setSelectedId(id);
    setPanelOpen(false);
    setDetailLoading(true);
    setDetail(null);
    setActionNote("");
    try {
      const data = await api.getReturnById(id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load return detail");
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Receipt lookup
  // ---------------------------------------------------------------------------
  const lookupReceipt = async () => {
    if (!receiptQuery.trim()) return;
    setReceiptLoading(true);
    setReceiptError(null);
    setSale(null);
    setSelectedLines({});
    try {
      const data = await api.getSaleByReceiptNo(receiptQuery.trim());
      setSale(data);
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : "Receipt not found");
    } finally {
      setReceiptLoading(false);
    }
  };

  const toggleLine = (saleItemId: string, maxQty: number) => {
    setSelectedLines((prev) => {
      if (prev[saleItemId] !== undefined) {
        const next = { ...prev };
        delete next[saleItemId];
        return next;
      }
      return { ...prev, [saleItemId]: 1 };
    });
  };

  const setLineQty = (saleItemId: string, qty: number, maxQty: number) => {
    const clamped = Math.max(1, Math.min(qty, maxQty));
    setSelectedLines((prev) => ({ ...prev, [saleItemId]: clamped }));
  };

  // ---------------------------------------------------------------------------
  // Create return
  // ---------------------------------------------------------------------------
  const submitReturn = async () => {
    if (!sale || Object.keys(selectedLines).length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.createReturn({
        saleId: sale.id,
        outletId: sale.outlet.id,
        reason,
        note: note.trim() || undefined,
        items: Object.entries(selectedLines).map(([saleItemId, quantity]) => ({
          saleItemId,
          quantity,
        })),
      });
      setMessage("Return request created successfully.");
      closePanelAndReset();
      await loadReturns();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create return");
    } finally {
      setSubmitting(false);
    }
  };

  const closePanelAndReset = () => {
    setPanelOpen(false);
    setReceiptQuery("");
    setSale(null);
    setSelectedLines({});
    setReason("DEFECTIVE");
    setNote("");
    setReceiptError(null);
    setSubmitError(null);
  };

  // ---------------------------------------------------------------------------
  // Approve / reject
  // ---------------------------------------------------------------------------
  const handleApprove = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      const updated = await api.approveReturn(detail.id, { note: actionNote.trim() || undefined });
      setDetail(updated);
      setMessage(`Return ${updated.returnNo} approved — refund ${money(updated.refundAmount)}.`);
      await loadReturns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve return");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      const updated = await api.rejectReturn(detail.id, { note: actionNote.trim() || undefined });
      setDetail(updated);
      setMessage(`Return ${updated.returnNo} rejected.`);
      await loadReturns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject return");
    } finally {
      setActionLoading(false);
    }
  };

  const canManage = session?.user?.permissions?.includes("returns:update") ?? false;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px] xl:items-start">
      {/* ── Left: list ── */}
      <section className="space-y-4">
        {/* Toolbar */}
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Returns &amp; Warranty</p>
            <h2 className="mt-0.5 text-lg font-bold">Return Requests</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReturnStatus | "ALL")}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <button
              type="button"
              onClick={() => { setPanelOpen(true); setSelectedId(null); setDetail(null); }}
              className="btn-primary text-sm"
            >
              + New Return
            </button>
          </div>
        </div>

        {message && (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>
        )}
        {error && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>
        )}

        {/* Table */}
        <div className="card overflow-hidden p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading returns…</p>
          ) : returns.length === 0 ? (
            <p className="p-6 text-sm text-muted">No return requests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-[0.12em] text-muted">
                    <th className="px-4 py-3">Return #</th>
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3">Outlet</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Refund</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {returns.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r.id)}
                      className={`cursor-pointer transition hover:bg-surface ${selectedId === r.id ? "bg-brand/5" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{r.returnNo}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.sale.receiptNo}</td>
                      <td className="px-4 py-3">{r.outlet.name}</td>
                      <td className="px-4 py-3 text-xs">{REASON_LABELS[r.reason]}</td>
                      <td className="px-4 py-3 text-center">{r._count.items}</td>
                      <td className="px-4 py-3 font-semibold">{money(r.refundAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{DATE_FMT(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Right: detail or new-return panel ── */}
      <aside className="space-y-4">
        {/* ── New Return Form ── */}
        {panelOpen && (
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">New Return / Warranty Claim</h3>
              <button type="button" onClick={closePanelAndReset} className="text-sm text-muted hover:text-ink">✕</button>
            </div>

            {/* Receipt lookup */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Receipt Number</label>
              <div className="flex gap-2">
                <input
                  value={receiptQuery}
                  onChange={(e) => setReceiptQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupReceipt()}
                  placeholder="e.g. REC-20260411-000001"
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={lookupReceipt}
                  disabled={receiptLoading}
                  className="btn-secondary text-sm"
                >
                  {receiptLoading ? "…" : "Look up"}
                </button>
              </div>
              {receiptError && <p className="mt-1.5 text-xs text-rose-600">{receiptError}</p>}
            </div>

            {/* Sale items */}
            {sale && (
              <>
                <div className="rounded-2xl border border-line bg-surface p-3 text-xs space-y-0.5">
                  <p className="font-semibold">{sale.outlet.name}</p>
                  <p className="text-muted">Receipt: {sale.receiptNo}</p>
                  <p className="text-muted">Total: {money(sale.total)}</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">Select items to return</label>
                  <div className="space-y-2">
                    {sale.items.map((line) => {
                      const checked = selectedLines[line.id] !== undefined;
                      return (
                        <div
                          key={line.id}
                          className={`rounded-xl border p-3 transition ${checked ? "border-brand bg-brand/5" : "border-line bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex cursor-pointer items-start gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleLine(line.id, line.quantity)}
                                className="mt-0.5 accent-brand"
                              />
                              <div>
                                <p className="text-sm font-medium leading-snug">{line.item.name}</p>
                                <p className="text-xs text-muted">{line.item.sku} · sold qty: {line.quantity}</p>
                              </div>
                            </label>
                            {checked && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setLineQty(line.id, (selectedLines[line.id] ?? 1) - 1, line.quantity)}
                                  className="h-6 w-6 rounded-lg border border-line text-xs font-bold leading-none"
                                >−</button>
                                <span className="min-w-6 text-center text-sm font-semibold">{selectedLines[line.id]}</span>
                                <button
                                  type="button"
                                  onClick={() => setLineQty(line.id, (selectedLines[line.id] ?? 1) + 1, line.quantity)}
                                  className="h-6 w-6 rounded-lg border border-line text-xs font-bold leading-none"
                                >+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReturnReason)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  >
                    {(Object.keys(REASON_LABELS) as ReturnReason[]).map((r) => (
                      <option key={r} value={r}>{REASON_LABELS[r]}</option>
                    ))}
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Note (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Customer description, serial number, etc."
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  />
                </div>

                {submitError && <p className="text-xs text-rose-600">{submitError}</p>}

                <button
                  type="button"
                  onClick={submitReturn}
                  disabled={submitting || Object.keys(selectedLines).length === 0}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Return Request"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Detail panel ── */}
        {selectedId && !panelOpen && (
          <div className="card space-y-4 p-5">
            {detailLoading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : detail ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted">{detail.returnNo}</p>
                    <h3 className="mt-0.5 text-base font-bold">{REASON_LABELS[detail.reason]}</h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[detail.status]}`}>
                    {detail.status}
                  </span>
                </div>

                {/* Meta */}
                <div className="rounded-2xl border border-line bg-surface p-3 space-y-1 text-xs">
                  <Row label="Sale" value={detail.sale.receiptNo} />
                  <Row label="Outlet" value={detail.outlet.name} />
                  <Row label="Refund Amount" value={money(detail.refundAmount)} bold />
                  <Row label="Created by" value={detail.createdBy.fullName} />
                  <Row label="Date" value={DATE_FMT(detail.createdAt)} />
                  {detail.processedBy && (
                    <Row label="Processed by" value={detail.processedBy.fullName} />
                  )}
                  {detail.note && <Row label="Note" value={detail.note} />}
                </div>

                {/* Items */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">Items</p>
                  <div className="space-y-2">
                    {detail.items.map((line) => (
                      <div key={line.id} className="flex justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{line.item.name}</p>
                          <p className="text-xs text-muted">{line.item.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{money(line.subtotal)}</p>
                          <p className="text-xs text-muted">×{line.quantity} @ {money(line.unitPrice)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Approve / Reject — manager only, pending only */}
                {canManage && detail.status === "PENDING" && (
                  <div className="space-y-3 border-t border-line pt-4">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Action</p>
                    <textarea
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      rows={2}
                      placeholder="Optional note (visible on record)"
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="flex-1 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {actionLoading ? "…" : "Approve & Refund"}
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="flex-1 rounded-2xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {actionLoading ? "…" : "Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {!panelOpen && !selectedId && (
          <div className="card flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm text-muted">Select a return to view details,</p>
            <p className="text-sm text-muted">or click <strong>+ New Return</strong> to raise a request.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
