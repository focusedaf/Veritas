"use client";

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
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-2xl border border-white/8 bg-[#111113] p-5 transition-colors hover:border-white/16 hover:bg-[#151518]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-400/10 p-3">
            <BriefcaseBusiness className="size-5 text-emerald-300" />
          </div>
          <div>
            <p className="font-semibold text-white">Project #{project.id}</p>
            <p className="mt-1 text-xs capitalize text-zinc-500">
              {project.role}
            </p>
          </div>
        </div>

        <ArrowUpRight className="size-4 text-zinc-500 transition-colors group-hover:text-white" />
      </div>

      <div className="mt-6">
        <p className="text-xs text-zinc-500">Escrow value</p>
        <p className="mt-1 text-2xl font-semibold text-white">
          {totalAmountETH} <span className="text-sm text-zinc-400">ETH</span>
        </p>
      </div>

      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/6">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all"
          style={{
            width: `${
              milestoneCount > 0
                ? Math.min(100, (completedMilestones / milestoneCount) * 100)
                : 0
            }%`,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {completedMilestones}/{milestoneCount} milestones completed
        </span>
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5" />
          {shortenAddress(
            project.role === "client" ? project.freelancer : project.client,
          )}
        </span>
      </div>
    </Link>
  );
}
