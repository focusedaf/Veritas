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
  { icon: BriefcaseBusiness, color: "text-blue-400", bg: "bg-blue-400/10" },
  { icon: ListChecks, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { icon: Clock3, color: "text-amber-400", bg: "bg-amber-400/10" },
  {
    icon: CircleDollarSign,
    color: "text-violet-400",
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
    { label: "Total projects", value: totalProjects },
    { label: "Active projects", value: activeProjects },
    { label: "Pending milestones", value: pendingMilestones },
    { label: "Total value", value: `${totalValueETH} ETH` },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => {
        const { icon: Icon, color, bg } = cardStyles[index];

        return (
          <article
            key={card.label}
            className="rounded-2xl border border-white/8 bg-[#111113] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  {card.value}
                </p>
              </div>

              <div className={`rounded-xl p-3 ${bg}`}>
                <Icon className={`size-5 ${color}`} />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
