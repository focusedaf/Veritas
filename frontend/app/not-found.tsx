import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/3">
        <ShieldAlert className="size-8 text-emerald-400" />
      </div>

      <p className="mt-6 text-xs font-semibold tracking-[0.25em] text-emerald-400">
        ERROR 404
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
        Page not found
      </h1>

      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
        This page doesn&apos;t exist or may have been moved.
      </p>

      <Link
        href="/"
        className="mt-7 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-black hover:bg-emerald-300"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>
    </main>
  );
}
