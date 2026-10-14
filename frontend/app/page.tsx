"use client";

import { useMemo } from "react";
import { CircleAlert, Wallet } from "lucide-react";
import { formatEther } from "ethers";

import { OverviewCards } from "@/components/dashboard/overview-cards";
import { PendingActions } from "@/components/dashboard/pending-actions";
import { RecentProjects } from "@/components/dashboard/recent-projects";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useWallet } from "@/hooks/use-wallet";
import type { ProjectMilestone } from "@/types/project";

const DONE = ["Paid", "Refunded", "Split"];
const ATTENTION = ["Submitted", "Disputed", "Revision Requested"];

function sumWei(list: ProjectMilestone[]): bigint {
  return list.reduce((total, m) => {
    try {
      return total + BigInt(m.amountWei || "0");
    } catch {
      return total;
    }
  }, BigInt(0));
}

function toETH(wei: bigint): string {
  return Number(formatEther(wei)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

export default function OverviewPage() {
  const {
    isConnected,
    isConnecting,
    connectWallet,
    isCorrectNetwork,
    error: walletError,
  } = useWallet();

  const { projects, milestones, isLoading, error, refreshProjects } =
    useProjects();

  const allMilestones = useMemo(
    () => Object.values(milestones).flat(),
    [milestones],
  );

  const activeProjects = useMemo(
    () =>
      projects.filter((p) => {
        const list = milestones[p.id] ?? [];
        return list.length === 0 || list.some((m) => !DONE.includes(m.status));
      }).length,
    [projects, milestones],
  );

  const pendingMilestones = useMemo(
    () => allMilestones.filter((m) => ATTENTION.includes(m.status)).length,
    [allMilestones],
  );

  const totalValueETH = useMemo(
    () => toETH(sumWei(allMilestones)),
    [allMilestones],
  );

  const recentProjects = useMemo(
    () =>
      projects.slice(0, 5).map((project) => {
        const list = milestones[project.id] ?? [];
        const completed =
          list.length > 0 && list.every((m) => DONE.includes(m.status));
        const disputed = list.some((m) => m.status === "Disputed");

        return {
          ...project,
          totalAmountETH: toETH(sumWei(list)),
          status: disputed
            ? "Disputed"
            : completed
              ? "Completed"
              : "In progress",
        };
      }),
    [projects, milestones],
  );

  const pendingActions = useMemo(
    () =>
      projects.flatMap((project) =>
        (milestones[project.id] ?? [])
          .filter((m) => {
            if (m.status === "Submitted") return project.role === "client";
            if (m.status === "Revision Requested")
              return project.role === "freelancer";
            if (m.status === "Disputed") return true;
            return false;
          })
          .map((m) => ({
            projectId: project.id,
            milestoneIndex: m.index,
            description: m.description,
            status: m.status,
            deadline: m.deadline,
          })),
      ),
    [projects, milestones],
  );

  if (!isConnected) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border border-white/10 bg-[#111113] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
            <Wallet className="size-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Connect your wallet
            </h2>
            <p className="text-xs text-zinc-400">
              Load your projects from the Sepolia blockchain.
            </p>
            {walletError && (
              <p role="alert" className="mt-1 text-xs text-red-300">
                {walletError}
              </p>
            )}
          </div>
        </div>

        <Button
          onClick={() => void connectWallet()}
          disabled={isConnecting}
          className="bg-emerald-400 text-black hover:bg-emerald-300"
        >
          {isConnecting ? "Connecting..." : "Connect MetaMask"}
        </Button>
      </section>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <section className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-medium text-amber-200">
            Switch to Sepolia
          </p>
          <p className="text-xs text-zinc-400">
            Change your MetaMask network to Ethereum Sepolia to continue.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {error && (
        <section
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-300">
              Could not load projects
            </p>
            <p className="mt-0.5 line-clamp-2 break-words text-xs text-zinc-400">
              {error}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshProjects()}
            disabled={isLoading}
            className="shrink-0 border-white/10 text-zinc-200"
          >
            Retry
          </Button>
        </section>
      )}

      <OverviewCards
        totalProjects={projects.length}
        activeProjects={activeProjects}
        pendingMilestones={pendingMilestones}
        totalValueETH={totalValueETH}
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        <RecentProjects projects={recentProjects} />
        <PendingActions actions={pendingActions} />
      </div>
    </div>
  );
}
