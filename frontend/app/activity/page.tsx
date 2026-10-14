"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileCheck2,
  Loader2,
  RefreshCw,
  Scale,
  Wallet,
} from "lucide-react";
import { formatEther } from "ethers";

import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useWallet } from "@/hooks/use-wallet";
import type { MilestoneStatus } from "@/types/project";

const panel = "rounded-xl border border-white/10 bg-[#111113]";

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
    case "Funded":
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
  const {
    address,
    isConnected,
    isCorrectNetwork,
    connectWallet,
    isConnecting,
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

  const activityItems = useMemo(
    () =>
      projects.flatMap((project) =>
        (milestones[project.id] ?? []).map((milestone) => ({
          projectId: project.id,
          milestoneIndex: milestone.index,
          description: milestone.description,
          status: milestone.status,
          amountWei: milestone.amountWei,
          deadline: milestone.deadline,
          submittedAt: milestone.submittedAt,
          disputedAt: milestone.disputedAt,
        })),
      ),
    [projects, milestones],
  );

  const sortedItems = useMemo(
    () =>
      [...activityItems].sort((a, b) => {
        const aTime = Math.max(a.submittedAt || 0, a.disputedAt || 0);
        const bTime = Math.max(b.submittedAt || 0, b.disputedAt || 0);
        return bTime - aTime || b.projectId.localeCompare(a.projectId);
      }),
    [activityItems],
  );

  // ---- Gate states (same pattern as Overview) ----
  if (!isConnected) {
    return (
      <section
        className={`${panel} flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
            <Wallet className="size-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Connect your wallet
            </h2>
            <p className="text-xs text-zinc-400">
              View milestones linked to your wallet on Sepolia.
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

  const stats = [
    { label: "Projects", value: projects.length.toLocaleString() },
    { label: "Milestones", value: activityItems.length.toLocaleString() },
    {
      label: "Latest scanned block",
      value: latestBlock === null ? "—" : latestBlock.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* Error */}
      {error && (
        <section
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-300">
              Could not load activity
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

      {/* Stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${panel} p-4`}>
            <p className="text-xs text-zinc-400">{stat.label}</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {isLoading ? "—" : stat.value}
            </p>
          </div>
        ))}
      </section>

      {/* Feed */}
      <section className={`${panel} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Milestone activity
            </h2>
            <p className="text-xs text-zinc-400">
              Current on-chain state of each milestone.
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
            {activityItems.length}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <Loader2 className="size-6 animate-spin text-emerald-300" />
            <p className="mt-3 text-sm text-zinc-300">
              Loading milestone data…
            </p>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Activity className="mx-auto size-8 text-zinc-600" />
            <h3 className="mt-3 text-sm font-medium text-white">
              No milestone activity yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-zinc-500">
              Create a project or join an existing one to see its milestones
              here.
            </p>
            <Link
              href="/projects/new"
              className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-400 px-3 text-sm font-medium text-black hover:bg-emerald-300"
            >
              Create project
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {sortedItems.map((item) => {
              const Icon = statusIcon(item.status);

              return (
                <article
                  key={`${item.projectId}-${item.milestoneIndex}`}
                  className="flex flex-col gap-3 px-4 py-3.5 transition hover:bg-white/[0.02] sm:flex-row sm:items-center"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${statusStyle(item.status)}`}
                  >
                    <Icon className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {item.description ||
                        `Milestone ${item.milestoneIndex + 1}`}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Project #{item.projectId} · Milestone{" "}
                      {item.milestoneIndex + 1} · Due{" "}
                      {formatDate(item.deadline)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${statusStyle(item.status)}`}
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
                      className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Details
                      <ArrowRight className="size-3.5" />
                    </Link>
                    <a
                      href={`https://sepolia.etherscan.io/address/${address}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View wallet on Etherscan"
                      title="View wallet on Etherscan"
                      className="text-zinc-500 hover:text-white"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

    
    </div>
  );
}
