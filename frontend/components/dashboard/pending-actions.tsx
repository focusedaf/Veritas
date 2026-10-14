"use client";

import Link from "next/link";
import { ArrowRight, Clock3, FileCheck2, Scale } from "lucide-react";
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

function getActionLabel(status: MilestoneStatus) {
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

export function PendingActions({ actions }: PendingActionsProps) {
  return (
    <section className="rounded-2xl border border-white/8 bg-[#111113]">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
        <div>
          <h2 className="font-semibold text-white">Pending actions</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Milestones that may need your attention
          </p>
        </div>

        <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
          {actions.length}
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <FileCheck2 className="mx-auto size-8 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-300">
            You’re all caught up
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            No pending milestone actions were provided.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/6">
          {actions.map((action) => {
            const Icon =
              action.status === "Disputed"
                ? Scale
                : action.status === "Submitted"
                  ? FileCheck2
                  : Clock3;

            return (
              <Link
                key={`${action.projectId}-${action.milestoneIndex}`}
                href={`/projects/${action.projectId}`}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/2.5"
              >
                <div className="rounded-xl bg-white/5 p-2.5">
                  <Icon className="size-4 text-zinc-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {action.description || `Milestone ${action.milestoneIndex + 1}`}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Project #{action.projectId} · {getActionLabel(action.status)}
                  </p>
                </div>

                <ArrowRight className="size-4 shrink-0 text-zinc-500" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
