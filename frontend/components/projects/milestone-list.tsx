"use client";

import { CheckCircle2, Clock3, FileText, Scale } from "lucide-react";
import type { ProjectMilestone } from "@/types/project";

type MilestoneListProps = {
  milestones: ProjectMilestone[];
  onSelect?: (milestone: ProjectMilestone) => void;
  selectedIndex?: number;
};

function getStatusStyle(status: ProjectMilestone["status"]) {
  switch (status) {
    case "Paid":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "Submitted":
      return "border-blue-400/20 bg-blue-400/10 text-blue-300";
    case "Disputed":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "Refunded":
      return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
    case "Revision Requested":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "Split":
      return "border-violet-400/20 bg-violet-400/10 text-violet-300";
    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

export function MilestoneList({
  milestones,
  onSelect,
  selectedIndex,
}: MilestoneListProps) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
        No milestones are available for this project.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {milestones.map((milestone) => {
        const selected = selectedIndex === milestone.index;
        const isComplete =
          milestone.status === "Paid" || milestone.status === "Refunded";
        const Icon = isComplete
          ? CheckCircle2
          : milestone.status === "Disputed"
            ? Scale
            : milestone.status === "Submitted"
              ? FileText
              : Clock3;

        return (
          <button
            key={milestone.index}
            type="button"
            onClick={() => onSelect?.(milestone)}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              selected
                ? "border-emerald-400/40 bg-emerald-400/5"
                : "border-white/8 bg-[#111113] hover:border-white/15"
            } ${onSelect ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-lg bg-white/5 p-2">
                  <Icon className="size-4 text-zinc-300" />
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-white">
                    Milestone {milestone.index + 1}
                  </p>
                  <p className="mt-1 wrap-break-word text-sm text-zinc-400">
                    {milestone.description}
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${getStatusStyle(milestone.status)}`}
              >
                {milestone.status}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>{milestone.amountETH} ETH</span>
              <span>
                {milestone.deadline
                  ? `Deadline: ${new Date(milestone.deadline * 1000).toLocaleDateString()}`
                  : "No deadline"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
