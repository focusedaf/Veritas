"use client";

import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import type { WalletProject } from "@/types/project";

type RecentProject = WalletProject & {
  totalAmountETH?: string;
  status?: string;
};

type RecentProjectsProps = {
  projects: RecentProject[];
};

export function RecentProjects({ projects }: RecentProjectsProps) {
  return (
    <section className="rounded-2xl border border-white/8 bg-[#111113]">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
        <div>
          <h2 className="font-semibold text-white">Recent projects</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Your latest escrow projects
          </p>
        </div>

        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          View all <ArrowRight className="size-4" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <FolderKanban className="mx-auto size-8 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-300">
            No projects yet
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Projects associated with your wallet will appear here.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300"
          >
            Create project
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-white/6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/2.5"
            >
              <div className="rounded-xl bg-emerald-400/10 p-3">
                <FolderKanban className="size-4 text-emerald-300" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">
                  Project #{project.id}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {project.role === "client"
                    ? "You are the client"
                    : project.role === "freelancer"
                      ? "You are the freelancer"
                      : "You are the arbitrator"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-zinc-200">
                  {project.totalAmountETH ?? "—"} ETH
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {project.status ?? "View details"}
                </p>
              </div>

              <ArrowRight className="size-4 shrink-0 text-zinc-500" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}