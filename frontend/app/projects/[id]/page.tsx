import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Project details
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Escrow project #{id}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/2 px-6 py-16 text-center">
        <FileText className="mx-auto size-8 text-zinc-600" />
        <p className="mt-4 text-sm text-zinc-400">
          Project details and milestone actions will appear here.
        </p>
      </div>
    </div>
  );
}
