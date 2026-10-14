"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleAlert,
  FolderKanban,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { formatEther } from "ethers";

import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useWallet } from "@/hooks/use-wallet";

type RoleFilter = "all" | "client" | "freelancer" | "arbitrator";

const DONE = ["Paid", "Refunded", "Split"];

const ROLE_TABS: [RoleFilter, string][] = [
  ["all", "All"],
  ["client", "Client"],
  ["freelancer", "Freelancer"],
  ["arbitrator", "Arbitrator"],
];

const panel = "rounded-xl border border-white/10 bg-[#111113]";

function shortenAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toETH(wei: bigint): string {
  return Number(formatEther(wei)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}

export default function ProjectsPage() {
  const {
    address,
    isConnected,
    isConnecting,
    connectWallet,
    isCorrectNetwork,
    error: walletError,
  } = useWallet();

  const { projects, milestones, isLoading, error, refreshProjects } =
    useProjects(address);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.id.toLowerCase().includes(query) ||
        project.client.toLowerCase().includes(query) ||
        project.freelancer.toLowerCase().includes(query);

      const matchesRole = roleFilter === "all" || project.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [projects, search, roleFilter]);

  const totalMilestones = useMemo(
    () =>
      Object.values(milestones).reduce((total, list) => total + list.length, 0),
    [milestones],
  );

  const totalValueETH = useMemo(() => {
    const wei = Object.values(milestones)
      .flat()
      .reduce((total, m) => {
        try {
          return total + BigInt(m.amountWei || "0");
        } catch {
          return total;
        }
      }, BigInt(0));
    return toETH(wei);
  }, [milestones]);

  const roleCounts = useMemo(
    () => ({
      all: projects.length,
      client: projects.filter((p) => p.role === "client").length,
      freelancer: projects.filter((p) => p.role === "freelancer").length,
      arbitrator: projects.filter((p) => p.role === "arbitrator").length,
    }),
    [projects],
  );

  const stats = [
    {
      label: "Total projects",
      value: projects.length.toString(),
      icon: FolderKanban,
      tone: "text-emerald-300",
    },
    {
      label: "Milestones",
      value: totalMilestones.toString(),
      icon: BriefcaseBusiness,
      tone: "text-sky-300",
    },
    {
      label: "Milestone value",
      value: `${totalValueETH} ETH`,
      icon: Wallet,
      tone: "text-violet-300",
    },
  ];

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
              Load the projects linked to your wallet from Sepolia.
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
     

      {/* Error */}
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

      {/* Stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`${panel} p-4`}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">{label}</p>
              <Icon className={`size-4 ${tone}`} />
            </div>
            <p className="mt-2 break-all text-xl font-semibold text-white">
              {isLoading ? "—" : value}
            </p>
          </div>
        ))}
      </section>

      {/* List */}
      <section className={`${panel} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoleFilter(value)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
                  roleFilter === value
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {label}
                <span className="opacity-70">{roleCounts[value]}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID or wallet address..."
              aria-label="Search projects"
              className="h-9 w-full rounded-md border border-white/10 bg-black/20 pl-9 pr-9 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <Loader2 className="size-6 animate-spin text-emerald-300" />
            <p className="mt-3 text-sm text-zinc-300">Loading projects…</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FolderKanban className="mx-auto size-8 text-zinc-600" />
            <h3 className="mt-3 text-sm font-medium text-white">
              {projects.length === 0
                ? "No projects yet"
                : "No matching projects"}
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-zinc-500">
              {projects.length === 0
                ? "Projects linked to your wallet will appear here once they are created on the escrow contract."
                : "Try a different search term or role filter."}
            </p>
            {projects.length === 0 ? (
              <Link
                href="/projects/new"
                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-400 px-3 text-sm font-medium text-black hover:bg-emerald-300"
              >
                <Plus className="size-3.5" />
                Create your first project
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                }}
                className="mt-4 border-white/10 text-zinc-200"
              >
                <X className="size-3.5" />
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/[0.06]">
              {filteredProjects.map((project) => {
                const list = milestones[project.id] ?? [];
                const completed = list.filter((m) =>
                  DONE.includes(m.status),
                ).length;
                const progress =
                  list.length > 0
                    ? Math.round((completed / list.length) * 100)
                    : 0;

                return (
                  <article
                    key={project.id}
                    className="flex flex-col gap-3 px-4 py-4 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:gap-5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                        <FolderKanban className="size-4 text-emerald-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-zinc-100">
                            Project #{project.id}
                          </h3>
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] capitalize text-emerald-300">
                            {project.role}
                          </span>
                        </div>
                        <p
                          className="mt-1 truncate font-mono text-xs text-zinc-500"
                          title={`${project.client} → ${project.freelancer}`}
                        >
                          {shortenAddress(project.client)} →{" "}
                          {shortenAddress(project.freelancer)}
                        </p>
                      </div>
                    </div>

                    <div className="w-full sm:w-44">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Progress</span>
                        <span className="text-zinc-300">
                          {list.length > 0
                            ? `${completed}/${list.length}`
                            : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 self-start rounded-md border border-white/10 px-3 text-xs font-medium text-zinc-200 transition hover:border-emerald-400/30 hover:bg-emerald-400/5 hover:text-emerald-300 sm:self-auto"
                    >
                      View
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-white/10 px-4 py-2.5 text-xs text-zinc-500">
              Showing {filteredProjects.length} of {projects.length} · Sepolia
              testnet
            </div>
          </>
        )}
      </section>
    </div>
  );
}
