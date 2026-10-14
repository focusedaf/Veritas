
"use client";

import Link from "next/link";
import {
  ArrowRight,
  FolderKanban,
  Plus,
  BriefcaseBusiness,
  UserRound,
  Scale,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import type { WalletProject } from "@/types/project";

type RecentProject = WalletProject & {
  totalAmountETH?: string;
  status?: string;
};

type RecentProjectsProps = {
  projects: RecentProject[];
};

function getRoleLabel(role: WalletProject["role"]): string {
  switch (role) {
    case "client":
      return "You are the client";
    case "freelancer":
      return "You are the freelancer";
    case "arbitrator":
      return "You are the arbitrator";
    default:
      return "Project participant";
  }
}

function getRoleIcon(role: WalletProject["role"]) {
  switch (role) {
    case "client":
      return BriefcaseBusiness;
    case "freelancer":
      return UserRound;
    case "arbitrator":
      return Scale;
    default:
      return FolderKanban;
  }
}

function getStatusStyle(status?: string): string {
  switch (status?.toLowerCase()) {
    case "active":
    case "funded":
    case "submitted":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
    case "completed":
    case "paid":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "disputed":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "refunded":
    case "split":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "revision requested":
      return "border-violet-400/20 bg-violet-400/10 text-violet-300";
    default:
      return "border-white/10 bg-white/5 text-zinc-400";
  }
}

function formatAmount(amount?: string): string {
  if (amount === undefined || amount.trim() === "") return "—";

  const value = Number(amount);

  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 4,
  });
}

export function RecentProjects({ projects }: RecentProjectsProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111114]">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="font-semibold text-white">Recent projects</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Your latest escrow projects
          </p>
        </div>

        <Link
          href="/projects"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-emerald-300"
        >
          View all
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
            <FolderKanban className="size-5 text-zinc-500" />
          </div>

          <p className="mt-4 text-sm font-medium text-zinc-200">
            No projects yet
          </p>

          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-zinc-500">
            Projects associated with your connected wallet will appear here.
          </p>

          <Link
            href="/projects/new"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300"
          >
            <Plus className="size-4" />
            Create project
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {projects.map((project) => {
            const RoleIcon = getRoleIcon(project.role);

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.025]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/[0.07]">
                  <FolderKanban className="size-4 text-emerald-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100 transition group-hover:text-emerald-300">
                    Project #{project.id}
                  </p>

                  <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                    <RoleIcon className="size-3 shrink-0 text-zinc-500" />
                    <p className="truncate text-xs text-zinc-500">
                      {getRoleLabel(project.role)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-sm font-medium text-zinc-200">
                    {formatAmount(project.totalAmountETH)}{" "}
                    <span className="text-xs text-zinc-500">ETH</span>
                  </p>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${getStatusStyle(
                      project.status
                    )}`}
                  >
                    {project.status?.toLowerCase() === "completed" ||
                    project.status?.toLowerCase() === "paid" ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <Clock3 className="size-3" />
                    )}
                    {project.status ?? "View details"}
                  </span>
                </div>

                <ArrowRight className="size-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
