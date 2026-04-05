"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Each nav item declares the permission required to see it (null = any logged-in user).
const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", permission: null },
  { href: "/dashboard/sales", label: "POS", permission: "sales:read" },
  { href: "/dashboard/repairs", label: "Repairs", permission: "repairs:read" },
  { href: "/dashboard/inventory", label: "Inventory", permission: "inventory:read" },
  { href: "/dashboard/transfers", label: "Transfers", permission: "transfers:read" },
  { href: "/dashboard/cash", label: "Cash", permission: "cash:read" },
  { href: "/dashboard/reports", label: "Reports", permission: "reports:read" },
  { href: "/dashboard/admin", label: "Admin", permission: "users:read" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // Close sidebar whenever route changes (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading || !user) return null;

  const visibleNav = NAV_ITEMS.filter(
    (item) => item.permission === null || hasPermission(item.permission),
  );

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const sidebarContent = (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">POS Console</p>
      <h2 className="mt-2 text-xl font-bold">Dashboard</h2>
      <nav className="mt-6 space-y-1">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-brand/10 hover:text-brand ${isActive ? "bg-brand/10 text-brand" : "text-ink"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-5">
        <p className="truncate text-sm font-medium">{user.fullName}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
        <p className="mt-0.5 text-xs capitalize text-muted">{user.role}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full flex-col md:grid md:grid-cols-[250px_1fr] md:gap-4 md:px-6 md:py-4">
      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col rounded-r-2xl border-r border-line bg-surface-elevated p-5 shadow-xl transition-transform duration-200 md:static md:flex md:w-auto md:translate-x-0 md:rounded-2xl md:border md:shadow-sm md:p-5 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebarContent}
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-0 md:py-0">
        <header className="card flex items-center justify-between p-4 md:p-5">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white md:hidden"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5 text-ink" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Operations</p>
            <h1 className="truncate text-lg font-bold md:text-2xl">Store Control Center</h1>
          </div>

          <div className="ml-3 flex items-center gap-3">
            <span className="hidden text-sm text-muted lg:block">{user.fullName}</span>
            <div className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand md:text-sm">
              Online
            </div>
          </div>
        </header>

        <div className="card min-w-0 p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
