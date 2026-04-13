"use client";

import { PaymentModal } from "../pos/payment-modal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type OutletRecord,
  type RepairJobDetail,
  type RepairJobSummary,
  type StockRow,
  type UserRecord,
} from "@/lib/api";
import { subscribeRepairRealtime } from "@/lib/realtime";
import Link from "next/link";

type RepairStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "DELIVERED" | "CANCELLED";

type FormState = {
  customerName: string;
  phone: string;
  outletId: string;
  technicianId: string;
  deviceBrand: string;
  deviceModel: string;
  serialNo: string;
  problemDesc: string;
  laborCost: string;
};

const INITIAL_FORM: FormState = {
  customerName: "",
  phone: "",
  outletId: "",
  technicianId: "",
  deviceBrand: "",
  deviceModel: "",
  serialNo: "",
  problemDesc: "",
  laborCost: "",
};

const NEXT_STATUS: Record<RepairStatus, RepairStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DONE", "CANCELLED"],
  DONE: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_STYLES: Record<RepairStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  DONE: "bg-emerald-100 text-emerald-700",
  DELIVERED: "bg-teal-100 text-teal-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

const REPAIR_REFRESH_MS = 5000;

const money = (value: number) => `Rs. ${value.toFixed(2)}`;

export function RepairScreen() {
  const session = api.getSession();
  const [jobs, setJobs] = useState<RepairJobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedJob, setSelectedJob] = useState<RepairJobDetail | null>(null);
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [technicians, setTechnicians] = useState<UserRecord[]>([]);
  const [partsCatalog, setPartsCatalog] = useState<StockRow[]>([]);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [partQuantity, setPartQuantity] = useState("1");
  const [partSearch, setPartSearch] = useState("");
  const [partDropdownOpen, setPartDropdownOpen] = useState(false);
  const partComboRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<RepairStatus | "ALL">("ALL");
  const [jobSearch, setJobSearch] = useState("");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentValues, setPaymentValues] = useState({ cash: "", card: "", mobile: "" });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "jobs">("create");
  const [jobDiscount, setJobDiscount] = useState(0);
  const [jobDiscountInput, setJobDiscountInput] = useState("");
  const sessionKey = session?.accessToken ?? "";

  const loadJobs = useCallback(
    async (status?: RepairStatus | "ALL") => {
      const { data } = await api.listRepairJobs({
        page: 1,
        limit: 100,
        status: status && status !== "ALL" ? status : undefined,
      });
      setJobs(data);
      return data;
    },
    [],
  );

  const loadSelectedJob = useCallback(async (jobId: string) => {
    const detail = await api.getRepairJob(jobId);
    setSelectedJob(detail);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (!sessionKey) {
        setLoading(false);
        return;
      }

      try {
        const [outletData, partsData] = await Promise.all([
          api.listOutlets(),
          api.listItems({ page: 1, limit: 100, type: "SPARE_PART", isActive: true }),
        ]);

        setOutlets(outletData);

        // Load stock rows for the first outlet so we get quantity alongside item info
        const firstOutletId = outletData[0]?.id ?? "";
        if (firstOutletId) {
          const stockData = await api.getOutletStock(firstOutletId, { page: 1, limit: 500 });
          const spareParts = stockData.data.filter(
            (row) => (row.item as { type?: string }).type === "SPARE_PART" || partsData.data.some((p) => p.id === row.item.id),
          );
          setPartsCatalog(spareParts);
          setSelectedPartId(spareParts[0]?.item.id ?? "");
        } else {
          // Fallback: no outlet yet, show items without stock count
          setPartsCatalog(partsData.data.map((p) => ({ id: p.id, quantity: 0, minQuantity: 0, item: p })) as StockRow[]);
          setSelectedPartId(partsData.data[0]?.id ?? "");
        }
        setForm((current) => ({ ...current, outletId: firstOutletId }));

        // Users listing requires users:read — silently skip if the role lacks it
        try {
          const usersData = await api.listUsers({ page: 1, limit: 100 });
          setTechnicians(usersData.data.filter((user) => user.role?.name === "TECHNICIAN"));
        } catch {
          // Role without users:read — technician dropdown will be empty
        }

        const loadedJobs = await loadJobs(statusFilter);
        if (loadedJobs[0]) {
          setSelectedJobId(loadedJobs[0].id);
          await loadSelectedJob(loadedJobs[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load repairs");
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    const reload = async () => {
      if (!sessionKey) return;
      try {
        const data = await loadJobs(statusFilter);
        // If the currently selected job is no longer in the filtered list, reset to first
        setSelectedJobId((current) => {
          if (!current) return data[0]?.id ?? "";
          return data.find((job) => job.id === current) ? current : (data[0]?.id ?? "");
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to filter jobs");
      }
    };

    void reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, statusFilter]);

  useEffect(() => {
    const reloadDetail = async () => {
      if (!selectedJobId || !sessionKey) {
        setSelectedJob(null);
        return;
      }

      try {
        await loadSelectedJob(selectedJobId);
        // Reset discount whenever a different job is selected
        setJobDiscount(0);
        setJobDiscountInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load repair detail");
      }
    };

    void reloadDetail();
  }, [loadSelectedJob, selectedJobId, sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;

    const refresh = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const data = await loadJobs(statusFilter);
        const currentSelectedId = selectedJobId;
        const nextSelectedId = currentSelectedId
          ? (data.some((job) => job.id === currentSelectedId) ? currentSelectedId : (data[0]?.id ?? ""))
          : (data[0]?.id ?? "");

        if (nextSelectedId !== currentSelectedId) {
          setSelectedJobId(nextSelectedId);
        } else if (nextSelectedId) {
          await loadSelectedJob(nextSelectedId);
        } else {
          setSelectedJob(null);
        }
      } catch {
        // Silent polling failure; keep last known UI state.
      }
    };

    const intervalId = window.setInterval(() => {
      void refresh();
    }, REPAIR_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadJobs, loadSelectedJob, selectedJobId, sessionKey, statusFilter]);

  useEffect(() => {
    if (!sessionKey) return;

    const unsubscribe = subscribeRepairRealtime(async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const data = await loadJobs(statusFilter);
        const currentSelectedId = selectedJobId;
        const nextSelectedId = currentSelectedId
          ? (data.some((job) => job.id === currentSelectedId) ? currentSelectedId : (data[0]?.id ?? ""))
          : (data[0]?.id ?? "");

        if (nextSelectedId !== currentSelectedId) {
          setSelectedJobId(nextSelectedId);
        } else if (nextSelectedId) {
          await loadSelectedJob(nextSelectedId);
        } else {
          setSelectedJob(null);
        }
      } catch {
        // Ignore realtime refresh failures and keep current UI state.
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadJobs, loadSelectedJob, selectedJobId, sessionKey, statusFilter]);

  const filteredParts = useMemo(
    () =>
      partsCatalog.filter(
        (row) =>
          row.item.name.toLowerCase().includes(partSearch.toLowerCase()) ||
          row.item.sku.toLowerCase().includes(partSearch.toLowerCase()),
      ),
    [partsCatalog, partSearch],
  );

  // Close part dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (partComboRef.current && !partComboRef.current.contains(e.target as Node)) {
        setPartDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visibleJobs = useMemo(() => {
    if (!jobSearch.trim()) return jobs;
    const q = jobSearch.trim().toLowerCase();
    return jobs.filter(
      (job) =>
        job.jobNo.toLowerCase().includes(q) ||
        (job.customer?.name ?? "").toLowerCase().includes(q) ||
        (job.customer?.phone ?? "").toLowerCase().includes(q) ||
        (job.outlet?.name ?? "").toLowerCase().includes(q) ||
        (job.technician?.fullName ?? "").toLowerCase().includes(q),
    );
  }, [jobs, jobSearch]);

  const queueStats = useMemo(
    () => ({
      open: jobs.filter((job) => job.status === "PENDING" || job.status === "IN_PROGRESS").length,
      done: jobs.filter((job) => job.status === "DONE").length,
      delivered: jobs.filter((job) => job.status === "DELIVERED").length,
    }),
    [jobs],
  );

  const selectedJobPartsCost =
    selectedJob?.parts.reduce((sum, part) => sum + Number(part.subtotal), 0) ?? 0;
  const selectedJobTotal = Number(selectedJob?.laborCost ?? 0) + selectedJobPartsCost;
  const selectedJobNet   = Math.max(0, selectedJobTotal - jobDiscount);

  const resolveCustomerId = async () => {
    const existing = await api.listCustomers({ search: form.phone.trim(), page: 1, limit: 20 });
    const matched = existing.data.find((customer) => customer.phone === form.phone.trim());
    if (matched) return matched.id;
    const created = await api.createCustomer({
      name: form.customerName.trim(),
      phone: form.phone.trim(),
    });
    return created.id;
  };

  const submitJob = async () => {
    if (!form.customerName || !form.phone || !form.outletId || !form.deviceBrand || !form.deviceModel || !form.problemDesc) {
      setError("Fill in the required repair job fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const customerId = await resolveCustomerId();
      const created = await api.createRepairJob({
        outletId: form.outletId,
        customerId,
        technicianId: form.technicianId || undefined,
        deviceBrand: form.deviceBrand,
        deviceModel: form.deviceModel,
        serialNo: form.serialNo || undefined,
        problemDesc: form.problemDesc,
        laborCost: Number(form.laborCost || 0),
      });

      setMessage("Repair job created.");
      setForm((current) => ({ ...INITIAL_FORM, outletId: current.outletId }));
      await loadJobs(statusFilter);
      setSelectedJobId(created.id);
      setActiveTab("jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create repair job");
    } finally {
      setSubmitting(false);
    }
  };

  const addPartToSelectedJob = async () => {
    if (!selectedJob || !selectedPartId) return;

    try {
      setError(null);
      setMessage(null);
      await api.addRepairPart(selectedJob.id, {
        itemId: selectedPartId,
        quantity: Number(partQuantity),
      });
      setPartQuantity("1");
      await Promise.all([loadJobs(statusFilter), loadSelectedJob(selectedJob.id)]);
      setMessage("Part added to repair job.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repair part");
    }
  };

  const updateSelectedJobStatus = async (status: RepairStatus) => {
    if (!selectedJob) return;

    try {
      setError(null);
      setMessage(null);
      await api.updateRepairStatus(selectedJob.id, { status });
      await Promise.all([loadJobs(statusFilter), loadSelectedJob(selectedJob.id)]);
      setMessage(`Repair marked as ${status.replace("_", " ").toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update repair status");
    }
  };

  const openPayment = () => {
    setPaymentValues({ cash: "", card: "", mobile: "" });
    setPaymentError(null);
    setPaymentOpen(true);
  };

  const confirmRepairPayment = async () => {
    if (!selectedJob) return;
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      const legs: Array<{ method: "CASH" | "CARD"; amount: number }> = [
        ...(Number(paymentValues.cash) > 0 ? [{ method: "CASH" as const, amount: Number(paymentValues.cash) }] : []),
        ...(Number(paymentValues.card) > 0 ? [{ method: "CARD" as const, amount: Number(paymentValues.card) }] : []),
        ...(Number(paymentValues.mobile) > 0 ? [{ method: "CARD" as const, amount: Number(paymentValues.mobile) }] : []),
      ];
      for (const leg of legs) {
        await api.addRepairAdvance(selectedJob.id, leg);
      }
      setPaymentOpen(false);
      setPaymentValues({ cash: "", card: "", mobile: "" });
      await Promise.all([loadJobs(statusFilter), loadSelectedJob(selectedJob.id)]);
      setMessage("Payment recorded.");
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-[28px] border border-line bg-white p-8">
        <h2 className="text-2xl font-bold">Repairs</h2>
        <p className="mt-3 text-sm text-muted">Sign in first to create repair jobs and update statuses.</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5 xl:h-[calc(100vh-6rem)] xl:flex xl:flex-col">

      {/* Stats + Tab header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="rounded-[20px] border border-line bg-white px-4 py-3">
            <p className="text-xs text-muted">Open queue</p>
            <p className="mt-0.5 text-2xl font-bold">{queueStats.open}</p>
          </div>
          <div className="rounded-[20px] border border-line bg-white px-4 py-3">
            <p className="text-xs text-muted">Done / delivered</p>
            <p className="mt-0.5 text-2xl font-bold">{queueStats.done + queueStats.delivered}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl border border-line bg-surface p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "create" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            Create job
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("jobs")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "jobs" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"}`}
          >
            Job list {jobs.length > 0 && <span className="ml-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-xs text-brand">{jobs.length}</span>}
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted">Loading repair workspace...</p> : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}

      {/* Tab: Create repair job */}
      {activeTab === "create" && (
        <div className="xl:flex-1 xl:overflow-y-auto">
          <div className="rounded-[28px] border border-line bg-white p-5">
            <div className="mb-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Repairs Desk</p>
              <h2 className="mt-1 text-2xl font-bold">Create repair job</h2>
              <p className="mt-1 text-sm text-muted">Capture customer, device, and problem details.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Customer name</span>
                <input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" placeholder="Customer name" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Phone</span>
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" placeholder="Customer phone" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Outlet</span>
                <select value={form.outletId} onChange={(event) => setForm((current) => ({ ...current, outletId: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                  {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Technician</span>
                <select value={form.technicianId} onChange={(event) => setForm((current) => ({ ...current, technicianId: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none">
                  <option value="">Unassigned</option>
                  {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Device brand</span>
                <input value={form.deviceBrand} onChange={(event) => setForm((current) => ({ ...current, deviceBrand: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" placeholder="Apple" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Device model</span>
                <input value={form.deviceModel} onChange={(event) => setForm((current) => ({ ...current, deviceModel: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" placeholder="iPhone 13" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Serial number</span>
                <input value={form.serialNo} onChange={(event) => setForm((current) => ({ ...current, serialNo: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" placeholder="Serial number" />
              </label>
              <label className="block md:max-w-[220px]">
                <span className="mb-1 block text-sm font-medium">Labor cost</span>
                <input value={form.laborCost} onChange={(event) => setForm((current) => ({ ...current, laborCost: event.target.value }))} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" placeholder="40" inputMode="decimal" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium">Problem description</span>
                <textarea value={form.problemDesc} onChange={(event) => setForm((current) => ({ ...current, problemDesc: event.target.value }))} className="min-h-28 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none" placeholder="Describe the customer issue" />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <div>
                <p className="text-sm text-muted">Estimated labor</p>
                <p className="mt-1 text-2xl font-bold">{money(Number(form.laborCost || 0))}</p>
              </div>
              <button type="button" onClick={submitJob} disabled={submitting} className="btn-primary disabled:cursor-not-allowed disabled:bg-muted">
                {submitting ? "Creating..." : "Create repair job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Job list */}
      {activeTab === "jobs" && (
        <div className="xl:flex-1 xl:overflow-y-auto">
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr] xl:items-start">

            {/* Job queue */}
            <div className="rounded-[28px] border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Job list</p>
                  <h3 className="mt-1 text-xl font-bold">Repair queue</h3>
                </div>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RepairStatus | "ALL")} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none">
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="DONE">Done</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <input
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search job no., customer, phone, outlet, technician…"
                className="mt-3 w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm outline-none ring-brand/30 transition focus:ring"
              />

              <div className="mt-4 space-y-3">
                {visibleJobs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">No jobs found.</p>
                ) : visibleJobs.map((job) => (
                  <button key={job.id} type="button" onClick={() => setSelectedJobId(job.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedJobId === job.id ? "border-brand bg-brand/5" : "border-line bg-surface hover:border-brand/50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{job.jobNo}</p>
                        <h4 className="mt-2 font-semibold">{job.customer?.name ?? "Unknown customer"}</h4>
                        <p className="mt-1 text-sm text-muted">{job.outlet?.name ?? "Unknown outlet"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[job.status]}`}>{job.status.replace("_", " ")}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted">
                      <span>{job.technician?.fullName ?? "Unassigned"}</span>
                      <span>{new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected job detail */}
            {selectedJob ? (
              <div className="rounded-[28px] border border-line bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Selected job</p>
                    <h3 className="mt-1 text-xl font-bold">{selectedJob.jobNo}</h3>
                    <p className="mt-1 text-sm text-muted">{selectedJob.customer?.name} • {selectedJob.customer?.phone || "No phone"}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[selectedJob.status]}`}>{selectedJob.status.replace("_", " ")}</span>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-muted sm:grid-cols-2">
                  <div className="rounded-xl bg-surface p-3">
                    <p className="text-xs uppercase tracking-[0.14em]">Device</p>
                    <p className="mt-1 font-semibold text-ink">{selectedJob.deviceBrand} {selectedJob.deviceModel}</p>
                    <p className="mt-1">SN: {selectedJob.serialNo || "N/A"}</p>
                  </div>
                  <div className="rounded-xl bg-surface p-3">
                    <p className="text-xs uppercase tracking-[0.14em]">Technician</p>
                    <p className="mt-1 font-semibold text-ink">{selectedJob.technician?.fullName ?? "Unassigned"}</p>
                    <p className="mt-1">Labor: {money(Number(selectedJob.laborCost ?? 0))}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-surface p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Issue</p>
                  <p className="mt-2 text-sm text-ink">{selectedJob.problemDesc}</p>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Parts used</h4>
                    <span className="text-sm text-muted">Total {money(selectedJobPartsCost)}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {selectedJob.parts.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">No parts recorded yet.</p>
                    ) : (
                      selectedJob.parts.map((part) => (
                        <div key={part.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-ink">{part.item.name}</span>
                            <span className="ml-2 text-muted">{part.item.sku} • x{part.quantity}</span>
                          </div>
                          <span className="font-semibold text-ink">{money(Number(part.subtotal))}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-line bg-surface p-4">
                  <p className="text-sm font-semibold">Add parts used</p>
                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div ref={partComboRef} className="relative flex-1">
                      <span className="mb-1 block text-sm font-medium">Part</span>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                        placeholder="Search by name or SKU…"
                        value={partDropdownOpen ? partSearch : (partsCatalog.find((row) => row.item.id === selectedPartId)?.item.name ?? "")}
                        onFocus={() => { setPartSearch(""); setPartDropdownOpen(true); }}
                        onChange={(e) => { setPartSearch(e.target.value); setPartDropdownOpen(true); }}
                      />
                      {!partDropdownOpen && selectedPartId && (() => {
                        const row = partsCatalog.find((r) => r.item.id === selectedPartId);
                        if (!row) return null;
                        const low = row.quantity <= row.minQuantity;
                        return (
                          <p className={`mt-1 text-xs font-medium ${low ? "text-rose-600" : "text-emerald-700"}`}>
                            {row.quantity} in stock{low ? " — low stock" : ""}
                          </p>
                        );
                      })()}
                      {partDropdownOpen && filteredParts.length > 0 && (
                        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-white shadow-lg">
                          {filteredParts.map((row) => (
                            <li
                              key={row.item.id}
                              className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-white"
                              onMouseDown={() => {
                                setSelectedPartId(row.item.id);
                                setPartSearch("");
                                setPartDropdownOpen(false);
                              }}
                            >
                              <div>
                                <span className="font-medium">{row.item.name}</span>
                                <span className="ml-2 opacity-60">{row.item.sku}</span>
                              </div>
                              <span className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                row.quantity <= row.minQuantity
                                  ? "bg-rose-100 text-rose-600"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {row.quantity} in stock
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {partDropdownOpen && filteredParts.length === 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-muted shadow-lg">No parts found</div>
                      )}
                    </div>
                    <label className="block w-full lg:max-w-[120px]">
                      <span className="mb-1 block text-sm font-medium">Qty</span>
                      <input value={partQuantity} onChange={(event) => setPartQuantity(event.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none" inputMode="numeric" />
                    </label>
                    <button type="button" onClick={addPartToSelectedJob} className="btn-secondary h-11">Add to job</button>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] bg-ink p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/70">Estimated total</p>
                      <p className="mt-1 text-2xl font-bold">{money(selectedJobTotal)}</p>
                    </div>
                    <div className="text-right text-sm text-white/70">
                      <p>{selectedJob.parts.length} part lines</p>
                      <p>Paid: {money(Number(selectedJob.advancePaid ?? 0))}</p>
                      <p>Balance: {money(Math.max(0, selectedJobTotal - Number(selectedJob.advancePaid ?? 0)))}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {NEXT_STATUS[selectedJob.status].length === 0 ? (
                      <span className="rounded-full bg-white/10 px-3 py-2 text-sm text-white/70">No further status actions</span>
                    ) : (
                      NEXT_STATUS[selectedJob.status].map((status) => (
                        <button key={status} type="button" onClick={() => updateSelectedJobStatus(status)} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:bg-accent hover:text-white">
                          Mark as {status.replace("_", " ")}
                        </button>
                      ))
                    )}
                    {selectedJob.status !== "CANCELLED" && selectedJob.status !== "DELIVERED" && Math.max(0, selectedJobTotal - Number(selectedJob.advancePaid ?? 0)) > 0 && (
                      <button
                        type="button"
                        onClick={openPayment}
                        className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
                      >
                        Take payment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
                Select a job from the list to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    <PaymentModal
      open={paymentOpen}
      total={Math.max(0, selectedJobNet - Number(selectedJob?.advancePaid ?? 0))}
      values={paymentValues}
      errorMessage={paymentError}
      submitting={paymentSubmitting}
      onClose={() => setPaymentOpen(false)}
      onChange={(field, value) => setPaymentValues((current) => ({ ...current, [field]: value }))}
      onConfirm={confirmRepairPayment}
    />
    </>
  );
}
