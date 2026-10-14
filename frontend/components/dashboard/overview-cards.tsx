
"use client";

import {
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  ListChecks,
  ArrowUpRight,
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
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "hover:border-blue-400/25",
  },
  {
    icon: ListChecks,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "hover:border-emerald-400/25",
  },
  {
    icon: Clock3,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "hover:border-amber-400/25",
  },
  {
    icon: CircleDollarSign,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "hover:border-violet-400/25",
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
      description: "Projects associated with your wallet",
    },
    {
      label: "Active projects",
      value: activeProjects.toLocaleString("en-IN"),
      description: "Projects currently in progress",
    },
    {
      label: "Pending milestones",
      value: pendingMilestones.toLocaleString("en-IN"),
      description: "Milestones requiring attention",
    },
    {
      label: "Milestone value",
      value: totalValueETH,
      suffix: "ETH",
      description: "Combined value of loaded milestones",
    },
  ];

  return (
    <section
      aria-label="Project overview"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card, index) => {
        const { icon: Icon, color, bg, border } = cardStyles[index];

        return (
          <article
            key={card.label}
            className={`group rounded-2xl border border-white/10 bg-[#111114] p-5 transition duration-200 hover:bg-[#151518] ${border}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-400">
                  {card.label}
                </p>

                <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="break-all text-2xl font-semibold tracking-tight text-white">
                    {card.value}
                  </p>

                  {"suffix" in card && (
                    <span className="text-sm font-medium text-zinc-500">
                      {card.suffix}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {card.description}
                </p>
              </div>

              <div
                className={`shrink-0 rounded-xl p-3 transition-transform duration-200 group-hover:scale-105 ${bg}`}
              >
                <Icon className={`size-5 ${color}`} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-[11px] text-zinc-600">
                Veritas Escrow
              </span>
              <ArrowUpRight
                className={`size-3.5 ${color} opacity-50 transition-opacity group-hover:opacity-100`}
              />
            </div>
          </article>
        );
      })}
    </section>
  );
}
