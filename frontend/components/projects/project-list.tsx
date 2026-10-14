"use client";

import { FolderKanban } from "lucide-react";
import { ProjectCard } from "@/components/projects/project-card";
import type { WalletProject } from "@/types/project";

type ProjectListItem = WalletProject & {
  totalAmountETH?: string;
  milestoneCount?: number;
  completedMilestones?: number;
};

type ProjectListProps = {
  projects: ProjectListItem[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function ProjectList({
  projects,
  isLoading = false,
  emptyTitle = "No projects found",
  emptyDescription = "Connect the wallet associated with a project, or create a new escrow project.",
}: ProjectListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-2xl border border-white/6 bg-white/2.5"
          />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
        <FolderKanban className="mx-auto size-9 text-zinc-600" />
        <h2 className="mt-4 font-semibold text-white">{emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          totalAmountETH={project.totalAmountETH}
          milestoneCount={project.milestoneCount}
          completedMilestones={project.completedMilestones}
        />
      ))}
    </div>
  );
}
