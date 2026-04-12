"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type OutletRecord, type StockRow, type SaleReceipt } from "@/lib/api";
import { useBarcodeScanner } from "@/lib/use-barcode-scanner";
import { CameraBarcodeScannerModal } from "./camera-barcode-scanner-modal";
import { PaymentModal } from "./payment-modal";
import { ReceiptModal } from "./receipt-modal";

type Product = {
  id: string;
  itemId: string;
  name: string;
  sku: string;
  price: number;
  discountPrice: number; // max allowed discount per unit
  stock: number;
  category: string;
};

type CartLine = Product & {
  quantity: number;
  discount: number; // flat Rs. amount off the line total
};

const asMoney = (value: number) => `Rs. ${value.toFixed(2)}`;

const mapStockToProduct = (row: StockRow): Product => ({
  id: row.id,
  itemId: row.item.id,
  name: row.item.name,
  sku: row.item.sku,
  price: Number(row.item.sellingPrice ?? 0),
  discountPrice: Number(row.item.discountPrice ?? 0),
  stock: row.quantity,
  category: row.item.category?.name ?? "General",
});

export function PosScreen() {
  const session = api.getSession();
  const sessionKey = session?.accessToken ?? "";
  const [query, setQuery] = useState("");
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false); // mobile cart panel toggle
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentValues, setPaymentValues] = useState({ cash: "", card: "", mobile: "" });
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleBarcodeScan = useCallback((code: string) => {
    setQuery(code);
  }, []);

  useBarcodeScanner({
    enabled: !!session && !!selectedOutletId,
    targetRef: searchInputRef,
    onScan: handleBarcodeScan,
  });

  useEffect(() => {
    const loadOutlets = async () => {
      if (!sessionKey) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.listOutlets();
        setOutlets(data.filter((outlet) => outlet.isActive !== false));
        setSelectedOutletId(data[0]?.id ?? "");
      } catch (err) {
        setScreenError(err instanceof Error ? err.message : "Failed to load outlets");
      } finally {
        setLoading(false);
      }
    };

    void loadOutlets();
  }, [sessionKey]);

  useEffect(() => {
    const loadStock = async () => {
      if (!selectedOutletId || !sessionKey) return;

      try {
        const { data } = await api.getOutletStock(selectedOutletId, { page: 1, limit: 100, search: query || undefined });
        setProducts(data.map(mapStockToProduct));
      } catch (err) {
        setScreenError(err instanceof Error ? err.message : "Failed to load stock");
      }
    };

    void loadStock();
  }, [query, selectedOutletId, sessionKey]);

  const filteredProducts = useMemo(() => {
    return products;
  }, [products]);

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart],
  );
  const totalDiscount = useMemo(
    () => cart.reduce((sum, line) => sum + line.discount, 0),
    [cart],
  );
  const total = subtotal - totalDiscount;
  const itemsCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const hasStockError = cart.some((line) => line.quantity > line.stock);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { ...product, quantity: 1, discount: 0 }];
    });
  };

  const setLineDiscount = (productId: string, value: string) => {
    setCart((current) =>
      current.map((line) => {
        if (line.id !== productId) return line;
        const parsed = parseFloat(value);
        const maxAllowed = line.discountPrice * line.quantity;
        const discount = isNaN(parsed) || parsed < 0 ? 0 : parsed > maxAllowed ? maxAllowed : parsed;
        return { ...line, discount };
      }),
    );
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.id === productId ? { ...line, quantity: line.quantity + delta } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((current) => current.filter((line) => line.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setPaymentValues({ cash: "", card: "", mobile: "" });
    setCustomerName("");
    setCustomerPhone("");
    setNote("");
    setCheckoutError(null);
    setPaymentOpen(false);
    setCartOpen(false);
  };

  const openPayment = () => {
    if (cart.length === 0 || hasStockError) return;
    setPaymentOpen(true);
  };

  const refreshStock = async () => {
    if (!selectedOutletId) return;
    const { data } = await api.getOutletStock(selectedOutletId, { page: 1, limit: 100, search: query || undefined });
    setProducts(data.map(mapStockToProduct));
  };

  const resolveCustomerId = async () => {
    if (!customerName.trim() || !customerPhone.trim()) return undefined;

    const customers = await api.listCustomers({ search: customerPhone.trim(), page: 1, limit: 20 });
    const existing = customers.data.find((customer) => customer.phone === customerPhone.trim());
    if (existing) return existing.id;

    const created = await api.createCustomer({
      name: customerName.trim(),
      phone: customerPhone.trim(),
    });
    return created.id;
  };

  const confirmPayment = async () => {
    if (!selectedOutletId) return;

    setSubmitting(true);
    setCheckoutError(null);

    try {
      const customerId = await resolveCustomerId();
      const payments = [
        Number(paymentValues.cash) > 0
          ? { method: "CASH" as const, amount: Number(paymentValues.cash) }
          : null,
        Number(paymentValues.card) > 0
          ? { method: "CARD" as const, amount: Number(paymentValues.card), reference: "CARD" }
          : null,
        Number(paymentValues.mobile) > 0
          ? { method: "CARD" as const, amount: Number(paymentValues.mobile), reference: "MOBILE" }
          : null,
      ].filter((payment) => payment !== null);

      const sale = await api.checkoutSale({
        outletId: selectedOutletId,
        customerId,
        note: note.trim() || undefined,
        discountAmt: 0,
        items: cart.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: line.price,
          discount: line.discount > 0 ? line.discount : undefined,
        })),
        payments,
      });

      setReceipt(sale);
      setSuccessMessage("Sale completed successfully.");
      // Open cash drawer (fire-and-forget; failure is non-blocking)
      void api.openCashDrawer().catch(() => {/* drawer not configured or unavailable */});
      clearCart();
      await refreshStock();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-[28px] border border-line bg-white p-8">
        <h2 className="text-2xl font-bold">Point of Sale</h2>
        <p className="mt-3 text-sm text-muted">Sign in first to load outlet stock and process live sales.</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile cart backdrop ── */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/40 xl:hidden"
          onClick={() => setCartOpen(false)}
        />
      )}

      <div className="relative grid gap-5 xl:grid-cols-[1.3fr_0.9fr] xl:h-[calc(100vh-6rem)] xl:items-stretch">
        {/* ── Products panel ── */}
        <section className="xl:flex xl:flex-col xl:min-h-0">
          {/* Sticky search bar */}
          <div className="rounded-[24px] border border-line bg-white p-4 xl:shrink-0">
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={selectedOutletId}
                  onChange={(event) => setSelectedOutletId(event.target.value)}
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none"
                >
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products by name, SKU, category, or scan barcode"
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none ring-brand/30 transition focus:ring"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setCameraScannerOpen(true)}
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                >
                  Scan with camera
                </button>
              </div>
            </div>
          </div>

          {loading ? <p className="mt-4 text-sm text-muted xl:shrink-0">Loading outlet stock...</p> : null}
          {screenError ? <p className="mt-4 text-sm font-medium text-rose-600 xl:shrink-0">{screenError}</p> : null}
          {successMessage ? <p className="mt-4 text-sm font-medium text-emerald-700 xl:shrink-0">{successMessage}</p> : null}

          {/* Scrollable product grid */}
          <div className="mt-5 xl:flex-1 xl:overflow-y-auto xl:pr-1">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => { addToCart(product); setCartOpen(true); }}
                className="rounded-[24px] border border-line bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg active:scale-95"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{product.sku}</p>
                    <h3 className="mt-2 text-base font-semibold leading-snug">{product.name}</h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-1 text-xs font-semibold text-muted">
                    {product.category}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted">Price</p>
                    <p className="text-xl font-bold">{asMoney(product.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">In stock</p>
                    <p className="text-sm font-semibold text-brand">{product.stock}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          </div>

          {/* bottom padding for mobile FAB */}
          <div className="h-20 xl:hidden" />
        </section>

        {/* ── Cart panel — slide-in on mobile, static on xl ── */}
        <aside
          className={`fixed bottom-0 left-0 right-0 z-30 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-line bg-white p-5 shadow-2xl transition-transform duration-300 xl:static xl:max-h-none xl:overflow-hidden xl:translate-y-0 xl:rounded-[28px] xl:shadow-sm xl:flex xl:flex-col ${cartOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Cart</p>
              <h3 className="mt-1 text-xl font-bold">Current order</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="rounded-xl border border-line px-3 py-2 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-xl border border-line p-2 text-muted transition hover:text-ink xl:hidden"
                aria-label="Close cart"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="grid gap-3">
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer name (optional)"
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                />
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Customer phone (optional)"
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                />
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Sale note"
                  className="min-h-20 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                />
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
                Tap a product card to add items.
              </div>
            ) : (
              cart.map((line) => (
                <div key={line.id} className={`rounded-2xl border p-4 ${line.quantity > line.stock ? "border-rose-400 bg-rose-50" : "border-line bg-surface"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{line.name}</p>
                      <p className="mt-1 text-xs text-muted">{line.sku}</p>
                    </div>
                    <div className="text-right">
                      {line.discount > 0 && (
                        <p className="text-xs text-muted line-through">{asMoney(line.price * line.quantity)}</p>
                      )}
                      <p className="text-sm font-semibold">{asMoney(line.price * line.quantity - line.discount)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-xl border border-line bg-white">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.id, -1)}
                        className="px-3 py-2 text-sm font-bold text-muted transition hover:text-ink"
                      >
                        −
                      </button>
                      <span className="min-w-10 px-2 text-center text-sm font-semibold">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.id, 1)}
                        disabled={line.quantity >= line.stock}
                        className="px-3 py-2 text-sm font-bold text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        +
                      </button>
                      <span className="mx-1 h-5 w-px bg-line" />
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.id)}
                        className="px-2.5 py-2 text-muted transition hover:text-rose-600"
                        aria-label="Remove item"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-muted">{asMoney(line.price)} each</p>
                  </div>
                  {line.quantity > line.stock && (
                    <p className="mt-2 text-xs font-medium text-rose-600">
                      Only {line.stock} in stock — reduce quantity
                    </p>
                  )}
                  {/* Per-item discount */}
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs font-medium text-muted">Discount</label>
                    <div className="flex items-center rounded-xl border border-line bg-white px-3 py-1.5">
                      <span className="mr-1 text-xs font-medium text-muted">Rs.</span>
                      <input
                        type="number"
                        min={0}
                        max={line.discountPrice * line.quantity}
                        step={0.01}
                        placeholder="0.00"
                        value={line.discount > 0 ? line.discount : ""}
                        onChange={(e) => setLineDiscount(line.id, e.target.value)}
                        disabled={line.discountPrice === 0}
                        className="w-20 bg-transparent text-xs font-semibold text-rose-600 outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </div>
                    {line.discountPrice > 0 && (
                      <span className="text-xs text-muted">max {asMoney(line.discountPrice * line.quantity)}</span>
                    )}
                    {line.discountPrice === 0 && (
                      <span className="text-xs text-muted italic">no discount</span>
                    )}
                    {line.discount > 0 && (
                      <button
                        type="button"
                        onClick={() => setLineDiscount(line.id, "0")}
                        className="text-xs text-muted transition hover:text-rose-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-ink p-5 text-white xl:shrink-0">
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Subtotal</span>
              <span>{asMoney(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="mt-2 flex items-center justify-between text-sm text-rose-400">
                <span>Discount</span>
                <span>− {asMoney(totalDiscount)}</span>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between text-xl font-bold">
              <span>Total</span>
              <span>{asMoney(total)}</span>
            </div>
            <button
              type="button"
              onClick={openPayment}
              disabled={hasStockError}
              className="mt-5 w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Take payment
            </button>
            {hasStockError ? (
              <p className="mt-3 text-xs text-rose-400">Some items exceed available stock. Adjust quantities to continue.</p>
            ) : (
              <p className="mt-3 text-xs text-white/70">Cash, card, and mobile payments.</p>
            )}
          </div>
        </aside>
      </div>

      {/* ── Mobile FAB: open cart ── */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-6 right-6 z-10 flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-brand xl:hidden"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6h11M9 19a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
        Cart
        {itemsCount > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold">{itemsCount}</span>
        )}
      </button>

      <PaymentModal
        open={paymentOpen}
        total={total}
        values={paymentValues}
        errorMessage={checkoutError}
        submitting={submitting}
        onClose={() => setPaymentOpen(false)}
        onChange={(field, value) => setPaymentValues((current) => ({ ...current, [field]: value }))}
        onConfirm={confirmPayment}
      />

      <ReceiptModal
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          setPaymentOpen(false);
        }}
      />

      <CameraBarcodeScannerModal
        open={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onDetected={(code) => {
          setQuery(code);
          searchInputRef.current?.focus();
        }}
        title="Scan item barcode"
      />
    </>
  );
}
