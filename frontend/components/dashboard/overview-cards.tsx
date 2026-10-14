"use client";

import {
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  ListChecks,
} from "lucide-react";

type OverviewCardsProps = {
  totalProjects: number;
  activeProjects: number;
  pendingMilestones: number;
  totalValueETH: string;
};

const cardStyles = [
  {
    icon: BriefcaseBusiness,
    color: "text-blue-300",
    bg: "bg-blue-400/10",
  },
  {
    icon: ListChecks,
    color: "text-emerald-300",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Clock3,
    color: "text-amber-300",
    bg: "bg-amber-400/10",
  },
  {
    icon: CircleDollarSign,
    color: "text-violet-300",
    bg: "bg-violet-400/10",
  },
];

export function OverviewCards({
  totalProjects,
  activeProjects,
  pendingMilestones,
  totalValueETH,
}: OverviewCardsProps) {
  const cards = [
    {
      label: "Total projects",
      value: totalProjects.toLocaleString("en-IN"),
      description: "Associated with your wallet",
    },
    {
      label: "Active projects",
      value: activeProjects.toLocaleString("en-IN"),
      description: "Currently in progress",
    },
    {
      label: "Pending milestones",
      value: pendingMilestones.toLocaleString("en-IN"),
      description: "Requiring your attention",
    },
    {
      label: "Milestone value",
      value: totalValueETH,
      suffix: "ETH",
      description: "Combined milestone value",
    },
  ];

  return (
    <section
      aria-label="Project overview"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4"
    >
      {cards.map((card, index) => {
        const { icon: Icon, color, bg } = cardStyles[index];

        return (
          <article
            key={card.label}
            className="min-w-0 rounded-xl border border-white/[0.08] bg-[#111113] p-4 transition-colors hover:border-white/[0.14] hover:bg-[#141416] sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="pt-1 text-sm font-medium text-zinc-400">
                {card.label}
              </p>

              <div className={`shrink-0 rounded-lg p-2.5 ${bg}`}>
                <Icon className={`size-4.5 ${color}`} />
              </div>
            </div>

            <div className="mt-4 flex min-h-9 min-w-0 items-baseline gap-2">
              <p className="min-w-0 truncate text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
                {card.value}
              </p>

              {"suffix" in card && (
                <span className="shrink-0 text-sm font-medium text-zinc-500">
                  {card.suffix}
                </span>
              )}
            </div>

            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {card.description}
            </p>
          </article>
        );
      })}
    </section>
  );
}
