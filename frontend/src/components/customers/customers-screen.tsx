"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type CustomerRecord } from "@/lib/api";

const EMPTY_FORM = { name: "", phone: "", email: "" };

export function CustomersScreen() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listCustomers({ page: 1, limit: 100, search: search.trim() || undefined });
      setCustomers(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.createCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });
      setCustomers((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      setForm(EMPTY_FORM);
      setMessage(`Customer "${created.name}" added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Directory</p>
        <h1 className="mt-1 text-2xl font-bold">Customers</h1>
      </div>

      {message && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Left — customer list */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-line bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
            <span className="shrink-0 text-xs text-muted">{total} total</span>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No customers found.</p>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="min-w-full divide-y divide-line text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {customers.map((c) => (
                    <tr key={c.id} className="transition hover:bg-surface">
                      <td className="px-3 py-3 font-medium">{c.name}</td>
                      <td className="px-3 py-3 font-mono text-xs">{c.phone}</td>
                      <td className="px-3 py-3 text-muted">{c.email ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right — add customer */}
        <div className="w-full rounded-[28px] border border-line bg-white p-6 lg:w-80">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">New</p>
          <h3 className="mt-1 text-xl font-bold">Add customer</h3>
          <div className="mt-5 space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Name</p>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Phone</p>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+94 77 000 0000"
                inputMode="tel"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Email <span className="normal-case font-normal text-muted">(optional)</span></p>
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="customer@email.com"
                inputMode="email"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-muted"
            >
              {saving ? "Adding…" : "Add customer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
