import { Activity } from "lucide-react";

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/3">
            <Activity className="size-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Activity
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Track your escrow transactions and project events.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/2 px-6 py-16 text-center">
        <Activity className="mx-auto size-8 text-zinc-600" />
        <h2 className="mt-4 text-sm font-medium text-zinc-300">
          Transaction activity
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Your on-chain activity will appear here as transaction history is
          integrated.
        </p>
      </div>
    </div>
  );
}
