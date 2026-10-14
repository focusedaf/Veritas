
"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { formatEther } from "ethers";

import { OverviewCards } from "@/components/dashboard/overview-cards";
import { PendingActions } from "@/components/dashboard/pending-actions";
import { RecentProjects } from "@/components/dashboard/recent-projects";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useWallet } from "@/hooks/use-wallet";
import type { ProjectMilestone } from "@/types/project";

export default function OverviewPage() {
  const {
    address,
    isConnected,
    isConnecting,
    connectWallet,
    isCorrectNetwork,
    error: walletError,
  } = useWallet();

  const {
    projects,
    milestones,
    isLoading,
    error,
    latestBlock,
    refreshProjects,
  } = useProjects(address);

  const allMilestones = useMemo<ProjectMilestone[]>(
    () => Object.values(milestones).flat(),
    [milestones]
  );

  const activeProjects = useMemo(
    () =>
      projects.filter((project) => {
        const projectMilestones = milestones[project.id] ?? [];

        // Do not classify a project with no loaded milestones as completed.
        return (
          projectMilestones.length === 0 ||
          projectMilestones.some(
            (milestone) =>
              milestone.status !== "Paid" &&
              milestone.status !== "Refunded" &&
              milestone.status !== "Split"
          )
        );
      }).length,
    [projects, milestones]
  );

  const pendingMilestones = useMemo(
    () =>
      allMilestones.filter(
        (milestone) =>
          milestone.status === "Submitted" ||
          milestone.status === "Disputed" ||
          milestone.status === "Revision Requested"
      ).length,
    [allMilestones]
  );

  const totalValueWei = useMemo(
    () =>
      allMilestones.reduce((total, milestone) => {
        try {
          return total + BigInt(milestone.amountWei || "0");
        } catch {
          return total;
        }
      }, BigInt(0)),
    [allMilestones]
  );

  const totalValueETH = useMemo(() => {
    const value = Number(formatEther(totalValueWei));

    return value.toLocaleString("en-US", {
      maximumFractionDigits: 4,
    });
  }, [totalValueWei]);

  const recentProjects = useMemo(
    () =>
      projects.slice(0, 5).map((project) => {
        const projectMilestones = milestones[project.id] ?? [];

        const totalWei = projectMilestones.reduce((total, milestone) => {
          try {
            return total + BigInt(milestone.amountWei || "0");
          } catch {
            return total;
          }
        }, BigInt(0));

        const isCompleted =
          projectMilestones.length > 0 &&
          projectMilestones.every((milestone) =>
            ["Paid", "Refunded", "Split"].includes(milestone.status)
          );

        const isDisputed = projectMilestones.some(
          (milestone) => milestone.status === "Disputed"
        );

        return {
          ...project,
          totalAmountETH: Number(formatEther(totalWei)).toLocaleString(
            "en-US",
            { maximumFractionDigits: 4 }
          ),
          status: isDisputed
            ? "Disputed"
            : isCompleted
              ? "Completed"
              : "In progress",
        };
      }),
    [projects, milestones]
  );

  const pendingActions = useMemo(
    () =>
      projects.flatMap((project) =>
        (milestones[project.id] ?? [])
          .filter((milestone) => {
            if (
              milestone.status !== "Submitted" &&
              milestone.status !== "Disputed" &&
              milestone.status !== "Revision Requested"
            ) {
              return false;
            }

            // Show only actions relevant to the connected wallet's role.
            if (
              milestone.status === "Submitted" &&
              project.role !== "client"
            ) {
              return false;
            }

            if (
              milestone.status === "Disputed" &&
              project.role !== "arbitrator" &&
              project.role !== "client" &&
              project.role !== "freelancer"
            ) {
              return false;
            }

            if (
              milestone.status === "Revision Requested" &&
              project.role !== "freelancer"
            ) {
              return false;
            }

            return true;
          })
          .map((milestone) => ({
            projectId: project.id,
            milestoneIndex: milestone.index,
            description: milestone.description,
            status: milestone.status,
            deadline: milestone.deadline,
          }))
      ),
    [projects, milestones]
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-emerald-400">
            SMART ESCROW WORKSPACE
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Overview
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            Track your escrow projects, monitor milestone progress, and manage
            payments secured by smart contracts.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {isConnected && (
            <Button
              variant="outline"
              onClick={() => void refreshProjects()}
              disabled={isLoading}
              className="border-white/10 bg-white/3 text-zinc-200 hover:bg-white/[0.07] hover:text-white"
            >
              <RefreshCw
                className={`mr-2 size-4 ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          )}

          <Link
            href="/projects/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-300"
          >
            <Plus className="mr-2 size-4" />
            New project
          </Link>
        </div>
      </section>

      {!isConnected ? (
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111113] p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-emerald-400/[0.07] blur-3xl" />

          <div className="relative max-w-xl">
            <div className="flex size-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
              <Wallet className="size-6 text-emerald-300" />
            </div>

            <h2 className="mt-5 text-xl font-semibold text-white">
              Connect your wallet
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Connect MetaMask to load your projects and milestone information
              from the Sepolia blockchain.
            </p>

            <Button
              onClick={() => void connectWallet()}
              disabled={isConnecting}
              className="mt-5 bg-emerald-400 text-black hover:bg-emerald-300"
            >
              <Wallet className="mr-2 size-4" />
              {isConnecting ? "Connecting..." : "Connect MetaMask"}
            </Button>

            {walletError && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {walletError}
              </p>
            )}
          </div>
        </section>
      ) : !isCorrectNetwork ? (
        <section className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-amber-200">
              Switch to Sepolia
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Your wallet is connected, but you need the Ethereum Sepolia
              network to interact with the escrow contract.
            </p>
          </div>
        </section>
      ) : (
        <>
          {error && (
            <section
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-400/5 p-4"
            >
              <p className="text-sm font-medium text-red-300">
                Could not load projects
              </p>
              <p className="mt-1 break-words text-sm text-zinc-400">
                {error}
              </p>

              <Button
                variant="outline"
                onClick={() => void refreshProjects()}
                disabled={isLoading}
                className="mt-3 border-white/10 text-zinc-200"
              >
                Try again
              </Button>
            </section>
          )}

          <OverviewCards
            totalProjects={projects.length}
            activeProjects={activeProjects}
            pendingMilestones={pendingMilestones}
            totalValueETH={totalValueETH}
          />

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <RecentProjects projects={recentProjects} />
            <PendingActions actions={pendingActions} />
          </div>

          <section className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-[#111113] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Sepolia blockchain
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {latestBlock !== null
                  ? `Latest scanned block: ${latestBlock.toLocaleString()}`
                  : "Waiting for blockchain data"}
              </p>
            </div>

            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-sm text-emerald-300 transition-colors hover:text-emerald-200"
            >
              Browse all projects
              <ArrowRight className="size-4" />
            </Link>
          </section>
        </>
      )}

      {isLoading && isConnected && isCorrectNetwork && (
        <p className="text-xs text-zinc-500">
          Loading project data from the blockchain…
        </p>
      )}
    </div>
  );
}
