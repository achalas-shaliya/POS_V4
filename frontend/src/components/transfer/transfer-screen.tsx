"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type ItemRecord,
  type OutletRecord,
  type TransferRecord,
  type WarehouseRecord,
} from "@/lib/api";

type LocationType = "WAREHOUSE" | "OUTLET";

type BasketLine = {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
};

const STATUS_STYLES: Record<TransferRecord["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  DISPATCHED: "bg-sky-100 text-sky-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

const getLocationName = (
  type: LocationType,
  id: string,
  outlets: OutletRecord[],
  warehouses: WarehouseRecord[],
) => {
  if (type === "OUTLET") return outlets.find((o) => o.id === id)?.name ?? id;
  return warehouses.find((w) => w.id === id)?.name ?? id;
};

export function TransferScreen() {
  const session = api.getSession();

  // ── Catalogue data ──────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [sourceStock, setSourceStock] = useState<Map<string, number>>(new Map());

  // ── Transfer builder ────────────────────────────────────────────────────
  const [fromType, setFromType] = useState<LocationType>("WAREHOUSE");
  const [fromId, setFromId] = useState("");
  const [toType, setToType] = useState<LocationType>("OUTLET");
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");

  // ── Item picker ──────────────────────────────────────────────────────────
  const [pickerItemId, setPickerItemId] = useState("");
  const [pickerQty, setPickerQty] = useState("1");
  const [itemSearch, setItemSearch] = useState("");
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const itemComboRef = useRef<HTMLDivElement>(null);

  // ── Basket (multi-item) ──────────────────────────────────────────────────
  const [basket, setBasket] = useState<BasketLine[]>([]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");

  const sessionKey = session?.accessToken ?? "";

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionKey) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const [warehouseData, outletData, itemData, { data: transferData }] = await Promise.all([
          api.listWarehouses(),
          api.listOutlets(),
          api.listItems({ page: 1, limit: 500, isActive: true }),
          api.listTransfers({ page: 1, limit: 100 }),
        ]);
        setWarehouses(warehouseData);
        setOutlets(outletData);
        setItems(itemData.data);
        setTransfers(transferData);

        const firstWarehouse = warehouseData[0]?.id ?? "";
        const firstOutlet = outletData[0]?.id ?? "";
        setFromId(firstWarehouse || outletData[1]?.id || "");
        setToId(firstOutlet || warehouseData[1]?.id || "");
        setPickerItemId(itemData.data[0]?.id ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transfer data");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [sessionKey]);

  // ── Filtered items for picker ────────────────────────────────────────────
  const filteredItems = useMemo(
    () =>
      itemSearch.trim()
        ? items.filter(
            (i) =>
              i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
              i.sku.toLowerCase().includes(itemSearch.toLowerCase()),
          )
        : items,
    [items, itemSearch],
  );

  const selectedPickerItem = items.find((i) => i.id === pickerItemId);

  // How many units of the selected item are already in the basket
  const alreadyInBasket = selectedPickerItem
    ? (basket.find((l) => l.itemId === selectedPickerItem.id)?.quantity ?? 0)
    : 0;
  // How many additional units can still be added
  const availableForSelectedItem = selectedPickerItem
    ? Math.max(0, (sourceStock.get(selectedPickerItem.id) ?? 0) - alreadyInBasket)
    : 0;
  const pickerQtyNum = Math.floor(Number(pickerQty));
  const pickerQtyExceedsStock =
    !!selectedPickerItem && !!fromId && pickerQtyNum > availableForSelectedItem;

  // Close item dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (itemComboRef.current && !itemComboRef.current.contains(e.target as Node)) {
        setItemDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch source location stock whenever fromType/fromId changes ──────────
  useEffect(() => {
    if (!fromId) { setSourceStock(new Map()); return; }
    const fetch = async () => {
      try {
        const response = fromType === "WAREHOUSE"
          ? await api.getWarehouseStock(fromId, { page: 1, limit: 500 })
          : await api.getOutletStock(fromId, { page: 1, limit: 500 });
        const map = new Map<string, number>();
        for (const row of response.data) {
          map.set(row.item.id, (map.get(row.item.id) ?? 0) + row.quantity);
        }
        setSourceStock(map);
      } catch {
        setSourceStock(new Map());
      }
    };
    void fetch();
  }, [fromType, fromId]);

  // ── Add item to basket ───────────────────────────────────────────────────
  const addToBasket = () => {
    const qty = Math.floor(Number(pickerQty));
    if (!selectedPickerItem || qty <= 0) return;

    if (pickerQtyExceedsStock) {
      setError(
        availableForSelectedItem === 0
          ? "No stock available at source for this item."
          : `Only ${availableForSelectedItem} unit${availableForSelectedItem !== 1 ? "s" : ""} available at source.`,
      );
      return;
    }

    setBasket((prev) => {
      const existing = prev.find((l) => l.itemId === selectedPickerItem.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === selectedPickerItem.id ? { ...l, quantity: l.quantity + qty } : l,
        );
      }
      return [
        ...prev,
        {
          itemId: selectedPickerItem.id,
          sku: selectedPickerItem.sku,
          name: selectedPickerItem.name,
          quantity: qty,
        },
      ];
    });
    setPickerQty("1");
  };

  const removeFromBasket = (itemId: string) => {
    setBasket((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const updateBasketQty = (itemId: string, qty: number) => {
    const intQty = Math.floor(qty);
    if (intQty <= 0) {
      removeFromBasket(itemId);
      return;
    }
    const available = sourceStock.get(itemId);
    const clamped = available !== undefined ? Math.min(intQty, available) : intQty;
    setBasket((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity: clamped } : l)));
  };

  // ── Submit bulk transfer ─────────────────────────────────────────────────
  const submitTransfer = async () => {
    if (basket.length === 0) {
      setError("Add at least one item to the basket.");
      return;
    }
    if (!fromId || !toId) {
      setError("Select source and destination locations.");
      return;
    }
    if (fromType === toType && fromId === toId) {
      setError("Source and destination must be different.");
      return;
    }

    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await api.createTransfer({
        fromType,
        fromId,
        toType,
        toId,
        items: basket.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        note: note.trim() || undefined,
      });
      setBasket([]);
      setNote("");
      const { data } = await api.listTransfers({ page: 1, limit: 100 });
      setTransfers(data);
      setMessage(`Transfer created with ${basket.length} line${basket.length !== 1 ? "s" : ""}.`);
      setActiveTab("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Dispatch a transfer ──────────────────────────────────────────────────
  const dispatch = async (transfer: TransferRecord) => {
    setActionLoading(transfer.id);
    setError(null);
    setMessage(null);
    try {
      await api.dispatchTransfer(transfer.id);
      const { data } = await api.listTransfers({ page: 1, limit: 100 });
      setTransfers(data);
      setMessage(`Transfer ${transfer.transferNo} dispatched.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch transfer");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Receive a transfer ───────────────────────────────────────────────────
  const receive = async (transfer: TransferRecord) => {
    setActionLoading(transfer.id);
    setError(null);
    setMessage(null);
    try {
      // listTransfers uses summary include (no items). Fetch the full detail first.
      const full = await api.getTransferById(transfer.id);
      if (!full.items || full.items.length === 0) {
        setError("Transfer has no items to receive.");
        setActionLoading(null);
        return;
      }
      await api.receiveTransfer(transfer.id, {
        items: full.items.map((i) => ({
          transferItemId: i.id,
          receivedQty: i.quantity,
        })),
      });
      const { data } = await api.listTransfers({ page: 1, limit: 100 });
      setTransfers(data);
      setMessage(`Transfer ${transfer.transferNo} received.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive transfer");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Cancel a transfer ────────────────────────────────────────────────────
  const cancel = async (transfer: TransferRecord) => {
    setActionLoading(transfer.id);
    setError(null);
    setMessage(null);
    try {
      await api.cancelTransfer(transfer.id);
      const { data } = await api.listTransfers({ page: 1, limit: 100 });
      setTransfers(data);
      setMessage(`Transfer ${transfer.transferNo} cancelled.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel transfer");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Location options ─────────────────────────────────────────────────────
  const fromOptions = fromType === "WAREHOUSE" ? warehouses : outlets;
  const toOptions = toType === "WAREHOUSE" ? warehouses : outlets;

  // ── Pending transfers need action ────────────────────────────────────────
  const pendingTransfers = transfers.filter((t) => t.status === "PENDING");
  const dispatchedTransfers = transfers.filter((t) => t.status === "DISPATCHED");
  const recentDone = transfers
    .filter((t) => t.status === "RECEIVED" || t.status === "CANCELLED")
    .slice(0, 10);

  if (!session) {
    return (
      <div className="rounded-[28px] border border-line bg-white p-8">
        <h2 className="text-2xl font-bold">Stock Transfers</h2>
        <p className="mt-3 text-sm text-muted">Sign in to manage stock transfers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 xl:h-[calc(100vh-6rem)] xl:flex xl:flex-col">

      {/* Stats + tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="rounded-[20px] border border-line bg-white px-4 py-3">
            <p className="text-xs text-muted">Pending</p>
            <p className="mt-0.5 text-2xl font-bold">{pendingTransfers.length}</p>
          </div>
          <div className="rounded-[20px] border border-line bg-white px-4 py-3">
            <p className="text-xs text-muted">In transit</p>
            <p className="mt-0.5 text-2xl font-bold">{dispatchedTransfers.length}</p>
          </div>
        </div>

        <div className="flex rounded-2xl border border-line bg-surface p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "create" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            Create transfer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "history" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            History {transfers.length > 0 && <span className="ml-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-xs text-brand">{transfers.length}</span>}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted xl:shrink-0">Loading transfer workspace...</p>}
      {error && <p className="text-sm font-medium text-rose-600 xl:shrink-0">{error}</p>}
      {message && <p className="text-sm font-medium text-emerald-700 xl:shrink-0">{message}</p>}

      {/* Tab: Create transfer */}
      {activeTab === "create" && (
        <div className="xl:flex-1 xl:min-h-0 xl:flex xl:flex-col">
          <div className="grid gap-5 xl:grid-cols-[1fr_480px] xl:flex-1 xl:min-h-0">
            {/* ── Left: locations + item picker ── */}
            <div className="rounded-[28px] border border-line bg-white p-6 space-y-6 xl:overflow-y-auto">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Transfer route</p>
                <h3 className="mt-1 text-xl font-bold">Set source &amp; destination</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* From */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted">From</label>
                  <select
                    value={fromType}
                    onChange={(e) => {
                      setFromType(e.target.value as LocationType);
                      setFromId("");
                    }}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="OUTLET">Outlet</option>
                  </select>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">— select —</option>
                    {fromOptions.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* To */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted">To</label>
                  <select
                    value={toType}
                    onChange={(e) => {
                      setToType(e.target.value as LocationType);
                      setToId("");
                    }}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="OUTLET">Outlet</option>
                    <option value="WAREHOUSE">Warehouse</option>
                  </select>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">— select —</option>
                    {toOptions.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Item picker */}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Add items</p>
                <h3 className="mt-1 text-lg font-bold">Pick items for this transfer</h3>

                <div className="mt-4 flex gap-2 items-end">
                  <div ref={itemComboRef} className="relative flex-1">
                    <span className="mb-1 block text-sm font-medium">Item</span>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none"
                      placeholder="Search by name or SKU…"
                      value={itemDropdownOpen ? itemSearch : (selectedPickerItem?.name ?? "")}
                      onFocus={() => { setItemSearch(""); setItemDropdownOpen(true); }}
                      onChange={(e) => { setItemSearch(e.target.value); setItemDropdownOpen(true); }}
                    />
                    {selectedPickerItem && !itemDropdownOpen && (() => {
                      const avail = sourceStock.get(selectedPickerItem.id) ?? 0;
                      return (
                        <p className={`mt-1 text-xs font-medium ${avail === 0 ? "text-rose-500" : avail <= 5 ? "text-amber-500" : "text-emerald-600"}`}>
                          {fromId ? `Available at source: ${avail} unit${avail !== 1 ? "s" : ""}` : "Select a source location first"}
                        </p>
                      );
                    })()}
                    {itemDropdownOpen && filteredItems.length > 0 && (
                      <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-white shadow-lg">
                        {filteredItems.map((item) => {
                          const avail = sourceStock.get(item.id) ?? 0;
                          return (
                            <li
                              key={item.id}
                              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-white"
                              onMouseDown={() => {
                                setPickerItemId(item.id);
                                setItemSearch("");
                                setItemDropdownOpen(false);
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="font-medium">{item.name}</span>
                                  <span className="ml-2 opacity-60">{item.sku}</span>
                                </div>
                                {fromId && (
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    avail === 0 ? "bg-rose-100 text-rose-700" : avail <= 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                  }`}>
                                    {avail}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {itemDropdownOpen && filteredItems.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-muted shadow-lg">No items found</div>
                    )}
                  </div>
                  <div>
                    <span className="mb-1 block text-sm font-medium">Qty</span>
                    <input
                      type="number"
                      min="1"
                      value={pickerQty}
                      onChange={(e) => setPickerQty(e.target.value)}
                      className={`w-24 rounded-xl border px-3 py-2.5 text-sm outline-none bg-surface ${
                        pickerQtyExceedsStock ? "border-rose-400" : "border-line"
                      }`}
                      placeholder="Qty"
                    />
                    {pickerQtyExceedsStock && (
                      <p className="mt-1 text-xs font-medium text-rose-500">
                        Max {availableForSelectedItem} unit{availableForSelectedItem !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={addToBasket}
                    disabled={!selectedPickerItem || Number(pickerQty) <= 0 || pickerQtyExceedsStock}
                    className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason or remarks for this transfer…"
                  maxLength={500}
                  rows={2}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none resize-none"
                />
              </div>
            </div>

            {/* ── Right: basket ── */}
            <div className="rounded-[28px] border border-line bg-white p-6 flex flex-col xl:min-h-0">
              <div className="shrink-0">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Transfer basket</p>
                <h3 className="mt-1 text-xl font-bold">Items to transfer</h3>
              </div>

              {basket.length === 0 ? (
                <div className="mt-6 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
                  <div>
                    <p className="text-sm font-medium text-ink">Basket is empty</p>
                    <p className="mt-1 text-xs text-muted">Search and add items on the left.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex-1 min-h-0 space-y-2 overflow-y-auto">
                  {basket.map((line) => (
                    <div
                      key={line.itemId}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{line.name}</p>
                        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                          {line.sku}
                        </p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateBasketQty(line.itemId, parseInt(e.target.value, 10) || 0)}
                        className="w-16 rounded-xl border border-line bg-white px-2 py-1.5 text-center text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeFromBasket(line.itemId)}
                        className="rounded-lg p-1.5 text-muted transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {basket.length > 0 && (
                <div className="mt-4 shrink-0 rounded-2xl border border-line bg-surface p-4 text-sm">
                  <div className="flex justify-between text-muted">
                    <span>Lines</span>
                    <span className="font-semibold text-ink">{basket.length}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-muted">
                    <span>Total units</span>
                    <span className="font-semibold text-ink">
                      {basket.reduce((s, l) => s + l.quantity, 0)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-muted">
                    <span>From</span>
                    <span className="font-semibold text-ink text-right max-w-[60%] truncate">
                      {fromId ? getLocationName(fromType, fromId, outlets, warehouses) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-muted">
                    <span>To</span>
                    <span className="font-semibold text-ink text-right max-w-[60%] truncate">
                      {toId ? getLocationName(toType, toId, outlets, warehouses) : "—"}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={submitTransfer}
                disabled={submitting || basket.length === 0 || !fromId || !toId}
                className="mt-4 shrink-0 w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Creating transfer…"
                  : basket.length === 0
                    ? "Add items to transfer"
                    : `Create transfer · ${basket.length} line${basket.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === "history" && (
        <div className="xl:flex-1 xl:flex xl:flex-col xl:min-h-0 space-y-5">

          {/* Pending */}
          <div className="rounded-[28px] border border-line bg-white p-6 xl:flex xl:flex-col xl:min-h-0">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted xl:shrink-0">Awaiting dispatch</p>
            <h3 className="mt-1 text-xl font-bold xl:shrink-0">Pending transfers</h3>
            {pendingTransfers.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">No pending transfers.</p>
            ) : (
              <div className="mt-4 xl:flex-1 xl:min-h-0 overflow-hidden rounded-[20px] border border-line">
                <div className="overflow-x-auto xl:h-full xl:overflow-y-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="bg-surface text-left text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Transfer #</th>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">To</th>
                        <th className="px-4 py-3 font-medium">Lines</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                      {pendingTransfers.map((t) => (
                        <tr key={t.id}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{t.transferNo}</td>
                          <td className="px-4 py-3 text-muted">
                            {getLocationName(t.fromType, t.fromId, outlets, warehouses)}
                            <span className="ml-1 text-xs">({t.fromType})</span>
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {getLocationName(t.toType, t.toId, outlets, warehouses)}
                            <span className="ml-1 text-xs">({t.toType})</span>
                          </td>
                          <td className="px-4 py-3">
                            {t.items?.length ?? 0} line{(t.items?.length ?? 0) !== 1 ? "s" : ""}
                            {t.items && t.items.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {t.items.map((i) => (
                                  <p key={i.id} className="text-xs text-muted">
                                    {i.item?.name ?? i.itemId} × {i.quantity}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[t.status]}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => dispatch(t)}
                                disabled={actionLoading === t.id}
                                className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200 disabled:opacity-50"
                              >
                                Dispatch
                              </button>
                              <button
                                type="button"
                                onClick={() => cancel(t)}
                                disabled={actionLoading === t.id}
                                className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* In transit */}
          <div className="rounded-[28px] border border-line bg-white p-6 xl:flex xl:flex-col xl:min-h-0">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted xl:shrink-0">In transit</p>
            <h3 className="mt-1 text-xl font-bold xl:shrink-0">Dispatched — awaiting receipt</h3>
            {dispatchedTransfers.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">No transfers in transit.</p>
            ) : (
              <div className="mt-4 xl:flex-1 xl:min-h-0 overflow-hidden rounded-[20px] border border-line">
                <div className="overflow-x-auto xl:h-full xl:overflow-y-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="bg-surface text-left text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Transfer #</th>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">To</th>
                        <th className="px-4 py-3 font-medium">Lines</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                      {dispatchedTransfers.map((t) => (
                        <tr key={t.id}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{t.transferNo}</td>
                          <td className="px-4 py-3 text-muted">
                            {getLocationName(t.fromType, t.fromId, outlets, warehouses)}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {getLocationName(t.toType, t.toId, outlets, warehouses)}
                          </td>
                          <td className="px-4 py-3">
                            {t.items?.length ?? 0} line{(t.items?.length ?? 0) !== 1 ? "s" : ""}
                            {t.items && t.items.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {t.items.map((i) => (
                                  <p key={i.id} className="text-xs text-muted">
                                    {i.item?.name ?? i.itemId} × {i.quantity}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => receive(t)}
                              disabled={actionLoading === t.id}
                              className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50"
                            >
                              {actionLoading === t.id ? "Processing…" : "Mark Received"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Completed / Cancelled */}
          <div className="rounded-[28px] border border-line bg-white p-6 xl:flex xl:flex-col xl:min-h-0">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted xl:shrink-0">History</p>
            <h3 className="mt-1 text-xl font-bold xl:shrink-0">Completed &amp; cancelled</h3>
            {recentDone.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">No completed transfers yet.</p>
            ) : (
              <div className="mt-4 xl:flex-1 xl:min-h-0 overflow-hidden rounded-[20px] border border-line">
                <div className="overflow-x-auto xl:h-full xl:overflow-y-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="bg-surface text-left text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Transfer #</th>
                        <th className="px-4 py-3 font-medium">From → To</th>
                        <th className="px-4 py-3 font-medium">Lines</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                      {recentDone.map((t) => (
                        <tr key={t.id}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{t.transferNo}</td>
                          <td className="px-4 py-3 text-muted">
                            {getLocationName(t.fromType, t.fromId, outlets, warehouses)} →{" "}
                            {getLocationName(t.toType, t.toId, outlets, warehouses)}
                          </td>
                          <td className="px-4 py-3 text-muted">{t.items?.length ?? 0}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[t.status]}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
