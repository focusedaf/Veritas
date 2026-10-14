"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Clock3,
  ExternalLink,
  FileCheck2,
  Loader2,
  RefreshCw,
  Scale,
  Wallet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatEther } from "ethers";

import { useWallet } from "@/hooks/use-wallet";
import { useProjects } from "@/hooks/use-projects";
import type { MilestoneStatus } from "@/types/project";

function formatETH(amountWei: string): string {
  try {
    const [whole, fraction = ""] = formatEther(BigInt(amountWei)).split(".");
    const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
    return trimmed
      ? `${Number(whole).toLocaleString("en-IN")}.${trimmed}`
      : Number(whole).toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

function formatDate(timestamp: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "No deadline";
  return new Date(timestamp * 1000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusStyle(status: MilestoneStatus): string {
  switch (status) {
    case "Submitted":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
    case "Disputed":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "Paid":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "Refunded":
    case "Split":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "Revision Requested":
      return "border-violet-400/20 bg-violet-400/10 text-violet-300";
    case "Funded":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
    default:
      return "border-white/10 bg-white/5 text-zinc-400";
  }
}

function statusIcon(status: MilestoneStatus) {
  switch (status) {
    case "Submitted":
      return FileCheck2;
    case "Disputed":
      return Scale;
    case "Paid":
      return CheckCircle2;
    case "Funded":
    case "Revision Requested":
      return Clock3;
    default:
      return Activity;
  }
}

export default function ActivityPage() {
  const { address, isConnected, isCorrectNetwork, connectWallet, isConnecting } =
    useWallet();

  const {
    projects,
    milestones,
    isLoading,
    error,
    latestBlock,
    refreshProjects,
  } = useProjects(address);

  const activityItems = useMemo(() => {
    return projects.flatMap((project) =>
      (milestones[project.id] ?? []).map((milestone) => ({
        projectId: project.id,
        milestoneIndex: milestone.index,
        description: milestone.description,
        status: milestone.status,
        amountWei: milestone.amountWei,
        deadline: milestone.deadline,
        submittedAt: milestone.submittedAt,
        disputedAt: milestone.disputedAt,
      }))
    );
  }, [projects, milestones]);

  const sortedItems = useMemo(
    () =>
      [...activityItems].sort((a, b) => {
        const aTime = Math.max(a.submittedAt || 0, a.disputedAt || 0);
        const bTime = Math.max(b.submittedAt || 0, b.disputedAt || 0);
        return bTime - aTime || b.projectId.localeCompare(a.projectId);
      }),
    [activityItems]
  );

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
              <Activity className="size-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Activity
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Review milestone status across your escrow projects.
              </p>
            </div>
          </div>
        </div>

        {isConnected && (
          <button
            type="button"
            onClick={() => void refreshProjects()}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        )}
      </header>

      {!isConnected ? (
        <section className="rounded-xl border border-white/10 bg-[#111114] px-6 py-12 text-center">
          <Wallet className="mx-auto size-8 text-zinc-500" />
          <h2 className="mt-4 font-medium text-white">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
            Connect MetaMask to view milestones associated with your wallet.
          </p>
          <button
            type="button"
            onClick={() => void connectWallet()}
            disabled={isConnecting}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
          >
            <Wallet className="size-4" />
            {isConnecting ? "Connecting..." : "Connect MetaMask"}
          </button>
        </section>
      ) : !isCorrectNetwork ? (
        <section className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-300" />
          <div>
            <h2 className="text-sm font-medium text-amber-200">
              Switch to Sepolia
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Switch your wallet to Ethereum Sepolia to load escrow data.
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
                Could not load activity
              </p>
              <p className="mt-1 break-words text-sm text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={() => void refreshProjects()}
                disabled={isLoading}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw className="size-4" />
                Try again
              </button>
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#111114] p-4">
              <p className="text-sm text-zinc-500">Projects</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {isLoading ? "—" : projects.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111114] p-4">
              <p className="text-sm text-zinc-500">Milestones</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {isLoading ? "—" : activityItems.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111114] p-4">
              <p className="text-sm text-zinc-500">Latest scanned block</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {latestBlock === null ? "—" : latestBlock.toLocaleString()}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#111114]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-semibold text-white">Milestone activity</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Current on-chain milestone states for your projects.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
                {activityItems.length}
              </span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center px-5 py-14 text-center">
                <Loader2 className="size-7 animate-spin text-emerald-300" />
                <p className="mt-3 text-sm text-zinc-300">
                  Loading milestone data…
                </p>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <Activity className="mx-auto size-8 text-zinc-600" />
                <h3 className="mt-3 font-medium text-white">
                  No milestone activity found
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  Create a project or participate in an existing escrow project
                  to see its milestones here.
                </p>
                <Link
                  href="/projects/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-300"
                >
                  Create project
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {sortedItems.map((item) => {
                  const Icon = statusIcon(item.status);
                  const explorerUrl = `https://sepolia.etherscan.io/address/${address}`;

                  return (
                    <article
                      key={`${item.projectId}-${item.milestoneIndex}`}
                      className="flex flex-col gap-3 px-5 py-4 transition hover:bg-white/[0.02] sm:flex-row sm:items-center"
                    >
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${statusStyle(item.status)}`}
                      >
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {item.description ||
                            `Milestone ${item.milestoneIndex + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Project #{item.projectId} · Milestone{" "}
                          {item.milestoneIndex + 1}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Deadline: {formatDate(item.deadline)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${statusStyle(item.status)}`}
                        >
                          {item.status}
                        </span>
                        <span className="text-sm font-medium text-zinc-200">
                          {formatETH(item.amountWei)} ETH
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <Link
                          href={`/projects/${item.projectId}`}
                          className="inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:text-emerald-200"
                        >
                          Details
                          <ArrowRight className="size-4" />
                        </Link>
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="View wallet on Etherscan"
                          title="View wallet on Etherscan"
                          className="text-zinc-500 hover:text-white"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs leading-5 text-zinc-500">
            This page shows current milestone states, not a complete transaction
            log. Historical transaction events and transaction hashes are not
            indexed here yet.
          </p>
        </>
      )}
    </div>
  );
}