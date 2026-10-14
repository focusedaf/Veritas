import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Create a project
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Set up your escrow agreement and milestones.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/2 p-8 text-center">
        <Plus className="mx-auto size-8 text-emerald-400" />
        <p className="mt-4 text-sm text-zinc-400">
          The project creation form will be connected to the escrow contract
          here.
        </p>
      </div>
    </div>
  );
}
