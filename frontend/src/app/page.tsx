import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col px-6 py-10 md:px-10">
      <section className="card relative overflow-hidden p-8 md:p-12">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10" />
        <div className="absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-accent/10" />

        <div className="relative space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            POS Frontend Starter
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            App Router frontend with auth screens and dashboard shell
          </h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            The base structure is ready for API integration with your backend module set.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary">
              Go to Login
            </Link>
            <Link href="/register" className="btn-secondary">
              Go to Register
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Auth pages</h2>
          <p className="mt-2 text-sm text-muted">Login and register screens with clean form layout.</p>
        </article>
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Dashboard layout</h2>
          <p className="mt-2 text-sm text-muted">Sidebar + topbar shell for reports, sales, repairs, and inventory.</p>
        </article>
        <article className="card p-5">
          <h2 className="text-lg font-semibold">Tailwind-ready UI</h2>
          <p className="mt-2 text-sm text-muted">Reusable utility classes and theme variables for rapid iteration.</p>
        </article>
      </section>
    </main>
  );
}
