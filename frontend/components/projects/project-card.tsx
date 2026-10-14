import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, UserRound } from "lucide-react";
import type { WalletProject } from "@/types/project";

type ProjectCardProps = {
  project: WalletProject;
  totalAmountETH?: string;
  milestoneCount?: number;
  completedMilestones?: number;
};

function shortenAddress(address: string) {
  if (!address) return "Not available";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ProjectCard({
  project,
  totalAmountETH = "—",
  milestoneCount = 0,
  completedMilestones = 0,
}: ProjectCardProps) {
  const progress =
    milestoneCount > 0
      ? Math.min(100, (completedMilestones / milestoneCount) * 100)
      : 0;

  const counterparty =
    project.role === "client" ? project.freelancer : project.client;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex min-h-56 flex-col rounded-xl border border-white/[0.08] bg-[#111113] p-4 transition-colors hover:border-white/[0.16] hover:bg-[#151518] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
            <BriefcaseBusiness className="size-5 text-emerald-300" />
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-white">Project #{project.id}</p>
            <p className="mt-1 text-xs capitalize text-zinc-500">
              {project.role}
            </p>
          </div>
        </div>

        <ArrowUpRight className="size-4 shrink-0 text-zinc-500 transition-colors group-hover:text-emerald-300" />
      </div>

      <div className="mt-6">
        <p className="text-xs text-zinc-500">Escrow value</p>
        <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-white">
          {totalAmountETH}{" "}
          <span className="text-sm font-medium text-zinc-500">ETH</span>
        </p>
      </div>

      <div className="mt-auto pt-6">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-label="Milestone completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span className="min-w-0">
            {completedMilestones}/{milestoneCount} completed
          </span>

          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound className="size-3.5 shrink-0" />
            <span className="truncate">{shortenAddress(counterparty)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
