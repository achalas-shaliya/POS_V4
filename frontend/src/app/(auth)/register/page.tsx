import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="card w-full p-6 md:p-8">
      <h2 className="text-2xl font-bold">Access setup</h2>
      <p className="mt-2 text-sm text-muted">
        This backend does not expose a public sign-up endpoint. New staff accounts are created by an
        authenticated admin from the dashboard admin panel.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        <p className="font-semibold text-ink">How to create an account</p>
        <p className="mt-2">1. Sign in with an admin account.</p>
        <p className="mt-1">2. Open the Admin section in the dashboard.</p>
        <p className="mt-1">3. Create the user and assign a role.</p>
      </div>

      <p className="mt-5 text-sm text-muted">
        Already have credentials?{" "}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-strong">
          Sign in
        </Link>
      </p>
    </div>
  );
}
