"use client";

import { useEffect, useState } from "react";
import { api, type CashRegister, type CashMovement, type OutletRecord } from "@/lib/api";

const money = (n: number | string) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(Number(n)).replace("LKR", "Rs.");

const MOVEMENT_LABELS: Record<CashMovement["type"], string> = {
  OPENING_FLOAT: "Opening float",
  SALE_CASH:     "Sale (cash)",
  REPAIR_CASH:   "Repair (cash)",
  CASH_IN:       "Cash in",
  CASH_OUT:      "Cash out",
};

const MOVEMENT_COLORS: Record<CashMovement["type"], string> = {
  OPENING_FLOAT: "bg-sky-100 text-sky-700",
  SALE_CASH:     "bg-emerald-100 text-emerald-700",
  REPAIR_CASH:   "bg-emerald-100 text-emerald-700",
  CASH_IN:       "bg-brand/10 text-brand",
  CASH_OUT:      "bg-rose-100 text-rose-700",
};

export function CashScreen() {
  const session = api.getSession();

  // ── Data ─────────────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [myRegister, setMyRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Open register form ────────────────────────────────────────────────────
  const [openForm, setOpenForm] = useState({ outletId: "", openingBalance: "", note: "" });

  // ── Cash in / out form ────────────────────────────────────────────────────
  const [moveForm, setMoveForm] = useState({ amount: "", note: "" });

  // ── Close form ────────────────────────────────────────────────────────────
  const [closeForm, setCloseForm] = useState({ actualCash: "", closingNote: "" });

  // ── Tab ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"register" | "history">("register");

  const sessionKey = session?.accessToken ?? "";

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  const reload = async () => {
    try {
      const [outletData, { data: regData }] = await Promise.all([
        api.listOutlets(),
        api.listRegisters({ limit: 50 }),
      ]);
      setOutlets(outletData);
      setRegisters(regData);
      if (outletData[0] && !openForm.outletId)
        setOpenForm((f) => ({ ...f, outletId: outletData[0].id }));

      // Try to load my open register
      try {
        const mine = await api.getMyOpenRegister();
        setMyRegister(mine);
        const [{ data: mvmts }, bal] = await Promise.all([
          api.listMovements(mine.id),
          api.getRegisterBalance(mine.id),
        ]);
        setMovements(mvmts);
        setBalance(bal.expectedCash);
      } catch {
        setMyRegister(null);
        setMovements([]);
        setBalance(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cash data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionKey) { setLoading(false); return; }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleOpen = async () => {
    setError(null); setMessage(null); setActionLoading(true);
    try {
      const bal = parseFloat(openForm.openingBalance);
      if (isNaN(bal) || bal < 0) { setError("Enter a valid opening balance."); return; }
      await api.openRegister({ outletId: openForm.outletId, openingBalance: bal, note: openForm.note || undefined });
      setMessage("Register opened.");
      setOpenForm((f) => ({ ...f, openingBalance: "", note: "" }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open register");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCashIn = async () => {
    if (!myRegister) return;
    setError(null); setMessage(null); setActionLoading(true);
    try {
      const amt = parseFloat(moveForm.amount);
      if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount."); return; }
      await api.cashIn(myRegister.id, { amount: amt, note: moveForm.note || undefined });
      setMessage(`Cash in: ${money(amt)}`);
      setMoveForm({ amount: "", note: "" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record cash in");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCashOut = async () => {
    if (!myRegister) return;
    setError(null); setMessage(null); setActionLoading(true);
    try {
      const amt = parseFloat(moveForm.amount);
      if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount."); return; }
      await api.cashOut(myRegister.id, { amount: amt, note: moveForm.note || undefined });
      setMessage(`Cash out: ${money(amt)}`);
      setMoveForm({ amount: "", note: "" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record cash out");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!myRegister) return;
    setError(null); setMessage(null); setActionLoading(true);
    try {
      const actual = parseFloat(closeForm.actualCash);
      if (isNaN(actual) || actual < 0) { setError("Enter a valid counted cash amount."); return; }
      await api.closeRegister(myRegister.id, { actualCash: actual, closingNote: closeForm.closingNote || undefined });
      setMessage("Register closed.");
      setCloseForm({ actualCash: "", closingNote: "" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close register");
    } finally {
      setActionLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-[28px] border border-line bg-white p-8">
        <h2 className="text-2xl font-bold">Cash Registry</h2>
        <p className="mt-3 text-sm text-muted">Sign in to manage cash registers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 xl:h-[calc(100vh-6rem)] xl:flex xl:flex-col">

      {loading && <p className="text-sm text-muted">Loading cash registry...</p>}
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      {message && <p className="text-sm font-medium text-emerald-700">{message}</p>}

      {/* ── Stats pills + Tab bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:shrink-0">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-line bg-white px-5 py-3">
            <p className="text-xs text-muted">Live balance</p>
            <p className="mt-0.5 text-xl font-bold">{balance !== null ? money(balance) : "—"}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-5 py-3">
            <p className="text-xs text-muted">My register</p>
            <p className="mt-0.5 text-xl font-bold">{myRegister ? myRegister.outlet?.name ?? "Open" : "Closed"}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-5 py-3">
            <p className="text-xs text-muted">Open registers</p>
            <p className="mt-0.5 text-xl font-bold">{registers.filter((r) => r.status === "OPEN").length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-5 py-3">
            <p className="text-xs text-muted">Today&apos;s movements</p>
            <p className="mt-0.5 text-xl font-bold">{movements.length}</p>
          </div>
        </div>

        <div className="flex rounded-2xl border border-line bg-surface p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("register")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              activeTab === "register" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              activeTab === "history" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
            }`}
          >
            History
            {registers.length > 0 && (
              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand font-mono">
                {registers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab: Register ── */}
      {activeTab === "register" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_400px] xl:items-start xl:flex-1 xl:overflow-y-auto">

          {/* Left: my register */}
          <div>
            {myRegister ? (
              <div className="rounded-[28px] border border-line bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">My Register</p>
                    <h3 className="mt-1 text-xl font-bold">
                      {myRegister.outlet?.name ?? "—"}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      Opened {new Date(myRegister.openedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    OPEN
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-surface p-3">
                    <p className="text-xs text-muted">Opening</p>
                    <p className="mt-1 text-lg font-bold">{money(myRegister.openingBalance)}</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-3">
                    <p className="text-xs text-muted">Live balance</p>
                    <p className="mt-1 text-lg font-bold">{balance !== null ? money(balance) : "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-3">
                    <p className="text-xs text-muted">Movements</p>
                    <p className="mt-1 text-lg font-bold">{movements.length}</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-3">
                    <p className="text-xs text-muted">Outlet</p>
                    <p className="mt-1 text-sm font-bold truncate">{myRegister.outlet?.name ?? "—"}</p>
                  </div>
                </div>

                {/* Cash in / out */}
                <div className="mt-5 rounded-[24px] border border-line bg-surface p-4">
                  <p className="text-sm font-semibold">Cash movement</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs font-medium text-muted">Amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={moveForm.amount}
                        onChange={(e) => setMoveForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                      />
                    </label>
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs font-medium text-muted">Note (optional)</span>
                      <input
                        value={moveForm.note}
                        onChange={(e) => setMoveForm((f) => ({ ...f, note: e.target.value }))}
                        placeholder="Reason…"
                        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                      />
                    </label>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCashIn}
                        disabled={actionLoading}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        Cash In
                      </button>
                      <button
                        type="button"
                        onClick={handleCashOut}
                        disabled={actionLoading}
                        className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        Cash Out
                      </button>
                    </div>
                  </div>
                </div>

                {/* Close register */}
                <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">Close register</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs font-medium text-amber-700">Physically counted cash</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={closeForm.actualCash}
                        onChange={(e) => setCloseForm((f) => ({ ...f, actualCash: e.target.value }))}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none"
                      />
                    </label>
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs font-medium text-amber-700">Closing note</span>
                      <input
                        value={closeForm.closingNote}
                        onChange={(e) => setCloseForm((f) => ({ ...f, closingNote: e.target.value }))}
                        placeholder="End of shift…"
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={actionLoading}
                      className="shrink-0 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : !loading ? (
              <div className="rounded-[28px] border border-dashed border-line bg-white p-8 text-center">
                <p className="font-semibold text-ink">No open register</p>
                <p className="mt-1 text-sm text-muted">Open a new register using the panel on the right.</p>
              </div>
            ) : null}

            {/* Today's movements */}
            {movements.length > 0 && (
              <div className="mt-5 rounded-[28px] border border-line bg-white p-6">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Today&apos;s movements</p>
                <h3 className="mt-1 text-xl font-bold">Cash log</h3>
                <div className="mt-4 overflow-hidden rounded-[20px] border border-line">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-line text-sm">
                      <thead className="bg-surface text-left text-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Note</th>
                          <th className="px-4 py-3 font-medium">By</th>
                          <th className="px-4 py-3 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line bg-white">
                        {movements.map((m) => (
                          <tr key={m.id}>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MOVEMENT_COLORS[m.type]}`}>
                                {MOVEMENT_LABELS[m.type]}
                              </span>
                            </td>
                            <td className={`px-4 py-3 font-semibold ${m.type === "CASH_OUT" ? "text-rose-600" : "text-emerald-700"}`}>
                              {m.type === "CASH_OUT" ? "-" : "+"}{money(m.amount)}
                            </td>
                            <td className="px-4 py-3 text-muted">{m.note ?? "—"}</td>
                            <td className="px-4 py-3 text-muted">{m.createdBy?.fullName ?? "—"}</td>
                            <td className="px-4 py-3 text-muted">{new Date(m.createdAt).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: open register form */}
          <div className="rounded-[28px] border border-line bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">New session</p>
            <h3 className="mt-1 text-xl font-bold">Open register</h3>
            {myRegister ? (
              <p className="mt-4 text-sm text-muted">You already have an open register. Close it before opening a new one.</p>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Outlet</span>
                  <select
                    value={openForm.outletId}
                    onChange={(e) => setOpenForm((f) => ({ ...f, outletId: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">— select outlet —</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Opening balance (Rs.)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openForm.openingBalance}
                    onChange={(e) => setOpenForm((f) => ({ ...f, openingBalance: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Note (optional)</span>
                  <input
                    value={openForm.note}
                    onChange={(e) => setOpenForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Start of shift…"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleOpen}
                  disabled={actionLoading || !openForm.outletId}
                  className="w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading ? "Opening…" : "Open register"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: History ── */}
      {activeTab === "history" && (
        <div className="space-y-5 xl:flex-1 xl:overflow-y-auto">

          {/* All registers */}
          {registers.length > 0 && (
            <div className="rounded-[28px] border border-line bg-white p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">All registers</p>
              <h3 className="mt-1 text-xl font-bold">Register history</h3>
              <div className="mt-4 overflow-hidden rounded-[20px] border border-line">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="bg-surface text-left text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Outlet</th>
                        <th className="px-4 py-3 font-medium">Opened by</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Opening</th>
                        <th className="px-4 py-3 font-medium">Expected</th>
                        <th className="px-4 py-3 font-medium">Actual</th>
                        <th className="px-4 py-3 font-medium">Variance</th>
                        <th className="px-4 py-3 font-medium">Opened at</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                      {registers.map((r) => {
                        const diff = r.difference !== undefined && r.difference !== null ? Number(r.difference) : null;
                        return (
                          <tr key={r.id}>
                            <td className="px-4 py-3 font-medium">{r.outlet?.name ?? "—"}</td>
                            <td className="px-4 py-3 text-muted">{r.openedBy?.fullName ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-surface text-muted"}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{money(r.openingBalance)}</td>
                            <td className="px-4 py-3">{r.expectedCash != null ? money(r.expectedCash) : "—"}</td>
                            <td className="px-4 py-3">{r.actualCash != null ? money(r.actualCash) : "—"}</td>
                            <td className={`px-4 py-3 font-semibold ${diff === null ? "" : diff < 0 ? "text-rose-600" : diff > 0 ? "text-emerald-700" : "text-muted"}`}>
                              {diff !== null ? money(diff) : "—"}
                            </td>
                            <td className="px-4 py-3 text-muted">{new Date(r.openedAt).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
