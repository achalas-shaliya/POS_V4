"use client";

import type { ChangeEvent } from "react";

type PaymentValues = {
  cash: string;
  card: string;
  mobile: string;
};

type PaymentModalProps = {
  open: boolean;
  total: number;
  values: PaymentValues;
  errorMessage?: string | null;
  submitting?: boolean;
  onClose: () => void;
  onChange: (field: keyof PaymentValues, value: string) => void;
  onConfirm: () => Promise<void> | void;
};

const methods: Array<{ key: keyof PaymentValues; label: string; hint: string }> = [
  { key: "cash", label: "Cash", hint: "Drawer payment" },
  { key: "card", label: "Card", hint: "POS terminal" },
  { key: "mobile", label: "Mobile", hint: "Wallet or transfer" },
];

const asMoney = (value: number) => `Rs. ${value.toFixed(2)}`;

export function PaymentModal({
  open,
  total,
  values,
  errorMessage,
  submitting = false,
  onClose,
  onChange,
  onConfirm,
}: PaymentModalProps) {
  if (!open) return null;

  const paid = Number(values.cash || 0) + Number(values.card || 0) + Number(values.mobile || 0);
  const balance = Math.max(total - paid, 0);
  const change = Math.max(paid - total, 0);

  const handleChange =
    (field: keyof PaymentValues) => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      if (nextValue === "" || /^\d*(\.\d{0,2})?$/.test(nextValue)) {
        onChange(field, nextValue);
      }
    };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-4 md:items-center">
      <div className="w-full max-w-2xl rounded-[28px] border border-line bg-surface-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Checkout</p>
            <h3 className="mt-1 text-2xl font-bold">Mixed payment</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            {methods.map((method) => (
              <div key={method.key} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{method.label}</h4>
                    <p className="text-sm text-muted">{method.hint}</p>
                  </div>
                  <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                    Split
                  </span>
                </div>
                <input
                  inputMode="decimal"
                  value={values[method.key]}
                  onChange={handleChange(method.key)}
                  placeholder="0.00"
                  className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-3 text-lg font-semibold outline-none ring-brand/30 transition focus:ring"
                />
              </div>
            ))}
          </section>

          <aside className="rounded-2xl border border-line bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Order total</span>
                <span className="font-semibold">{asMoney(total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Amount paid</span>
                <span className="font-semibold">{asMoney(paid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Balance</span>
                <span className="font-semibold text-accent">{asMoney(balance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Change</span>
                <span className="font-semibold text-brand">{asMoney(change)}</span>
              </div>
            </div>

            {errorMessage ? (
              <p className="mt-4 text-sm font-medium text-rose-600">{errorMessage}</p>
            ) : null}

            <button
              type="button"
              onClick={onConfirm}
              disabled={paid < total || submitting}
              className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:bg-muted"
            >
              {submitting ? "Processing..." : "Confirm payment"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
