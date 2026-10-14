import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your milestone-based escrow projects.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-black hover:bg-emerald-300"
        >
          <Plus className="size-4" />
          New project
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/2 px-6 py-16 text-center">
        <FolderKanban className="mx-auto size-8 text-zinc-600" />
        <p className="mt-4 text-sm text-zinc-400">
          Your projects will appear here.
        </p>
      </div>
    </div>
  );
}
