"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  // Show nothing while loading or while redirecting authenticated users
  if (isLoading || user) return null;

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-8 px-4 py-10 sm:px-6 md:grid md:grid-cols-[1.2fr_1fr] md:items-stretch md:justify-normal md:px-10">
      <section className="card hidden h-full p-10 md:flex md:flex-col md:justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">POS Access</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight">Welcome back to your operations hub</h1>
        <p className="mt-4 text-sm text-muted">
          Manage sales, repairs, inventory, cash sessions, and reports from one dashboard.
        </p>
      </section>
      <section className="flex w-full max-w-sm flex-col justify-center md:max-w-none">{children}</section>
    </main>
  );
}
