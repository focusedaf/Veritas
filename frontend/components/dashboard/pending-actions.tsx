
"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  FileCheck2,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

import type { MilestoneStatus } from "@/types/project";

export type PendingAction = {
  projectId: string;
  milestoneIndex: number;
  description: string;
  status: MilestoneStatus;
  deadline?: number;
};

type PendingActionsProps = {
  actions: PendingAction[];
};

function getActionLabel(status: MilestoneStatus): string {
  switch (status) {
    case "Submitted":
      return "Review submitted work";
    case "Disputed":
      return "Resolve dispute";
    case "Revision Requested":
      return "Resubmit work";
    case "Funded":
      return "Work pending";
    default:
      return "View milestone";
  }
}

function getActionIcon(status: MilestoneStatus) {
  switch (status) {
    case "Submitted":
      return FileCheck2;
    case "Disputed":
      return Scale;
    case "Revision Requested":
      return RotateCcw;
    case "Funded":
      return Clock3;
    default:
      return CheckCircle2;
  }
}

function getIconStyles(status: MilestoneStatus): string {
  switch (status) {
    case "Submitted":
      return "bg-sky-400/10 text-sky-300";
    case "Disputed":
      return "bg-red-400/10 text-red-300";
    case "Revision Requested":
      return "bg-amber-400/10 text-amber-300";
    case "Funded":
      return "bg-violet-400/10 text-violet-300";
    default:
      return "bg-white/5 text-zinc-300";
  }
}

function formatDeadline(deadline?: number): string | null {
  if (!deadline || !Number.isFinite(deadline)) return null;

  const remaining = deadline * 1000 - Date.now();
  const hours = Math.ceil(remaining / (1000 * 60 * 60));

  if (remaining <= 0) return "Deadline passed";
  if (hours < 24) return `${hours}h remaining`;

  const days = Math.ceil(hours / 24);
  return `${days}d remaining`;
}

export function PendingActions({ actions }: PendingActionsProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111114]">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="font-semibold text-white">Pending actions</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Milestones that may need your attention
          </p>
        </div>

        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-xs font-semibold text-amber-300">
          {actions.length}
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-400/10">
            <CheckCircle2 className="size-5 text-emerald-300" />
          </div>

          <p className="mt-3 text-sm font-medium text-zinc-200">
            You're all caught up
          </p>

          <p className="mt-1 text-xs leading-5 text-zinc-500">
            No pending milestone actions were provided.
          </p>

          <Link
            href="/projects"
            className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-emerald-300 transition hover:text-emerald-200"
          >
            View all projects
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {actions.map((action) => {
            const Icon = getActionIcon(action.status);
            const deadlineLabel = formatDeadline(action.deadline);
            const deadlinePassed = deadlineLabel === "Deadline passed";

            return (
              <Link
                key={`${action.projectId}-${action.milestoneIndex}`}
                href={`/projects/${action.projectId}`}
                className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${getIconStyles(
                    action.status
                  )}`}
                >
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200 transition group-hover:text-white">
                    {action.description ||
                      `Milestone ${action.milestoneIndex + 1}`}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Project #{action.projectId} ·{" "}
                    {getActionLabel(action.status)}
                  </p>

                  {deadlineLabel && (
                    <p
                      className={`mt-2 inline-flex items-center gap-1.5 text-xs ${
                        deadlinePassed
                          ? "text-red-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {deadlinePassed ? (
                        <AlertTriangle className="size-3.5" />
                      ) : (
                        <Clock3 className="size-3.5" />
                      )}
                      {deadlineLabel}
                    </p>
                  )}
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
