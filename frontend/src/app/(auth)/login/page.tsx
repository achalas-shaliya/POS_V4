"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reason = searchParams.get("reason");
  const reasonMessage =
    reason === "session_expired"
      ? "Your session has expired. Please sign in again to continue."
      : null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card w-full p-6 shadow-md md:p-8">
      <h2 className="text-2xl font-bold">Sign in</h2>
      <p className="mt-2 text-sm text-muted">Enter your account credentials to continue.</p>

      {reasonMessage && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {reasonMessage}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className="w-full rounded-xl border border-line bg-white px-3 py-3 text-base outline-none ring-brand/30 transition focus:ring"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-line bg-white px-3 py-3 text-base outline-none ring-brand/30 transition focus:ring"
          />
        </label>
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        <button type="submit" className="btn-primary w-full py-3 text-base disabled:cursor-not-allowed disabled:bg-muted" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        User accounts are created from the admin panel. See{" "}
        <Link href="/register" className="font-semibold text-brand hover:text-brand-strong">
          access setup
        </Link>
        .
      </p>
    </div>
  );
}
