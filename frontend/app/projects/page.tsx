
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  Search,
  RefreshCw,
  ArrowUpRight,
  Wallet,
  CircleAlert,
  Loader2,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  X,
} from "lucide-react";

import { useWallet } from "@/hooks/use-wallet";
import { useProjects } from "@/hooks/use-projects";

type RoleFilter = "all" | "client" | "freelancer" | "arbitrator";

function shortenAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ProjectsPage() {
  const { address, isConnected, connectWallet, isConnecting } = useWallet();

  const {
    projects,
    milestones,
    isLoading,
    error,
    refreshProjects,
  } = useProjects(address);

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

      const matchesRole =
        roleFilter === "all" || project.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [projects, search, roleFilter]);

  // milestones is Record<string, ProjectMilestone[]>, keyed by project ID.
  const totalMilestones = useMemo(() => {
    return Object.values(milestones).reduce(
      (total, projectMilestones) => total + projectMilestones.length,
      0
    );
  }, [milestones]);

  // Sum of all loaded milestone amounts in wei.
  const totalBudgetWei = useMemo(() => {
    return Object.values(milestones).reduce(
      (projectTotal, projectMilestones) => {
        return projectMilestones.reduce((milestoneTotal, milestone) => {
          try {
            return milestoneTotal + BigInt(milestone.amountWei);
          } catch {
            return milestoneTotal;
          }
        }, projectTotal);
      },
      BigInt(0)
    );
  }, [milestones]);

  const totalBudgetETH = useMemo(() => {
    const weiPerEther = BigInt("1000000000000000000");
    const whole = totalBudgetWei / weiPerEther;
    const fraction = totalBudgetWei % weiPerEther;

    const fractionalText = fraction
      .toString()
      .padStart(18, "0")
      .slice(0, 6)
      .replace(/0+$/, "");

    return fractionalText
      ? `${whole.toLocaleString("en-IN")}.${fractionalText}`
      : whole.toLocaleString("en-IN");
  }, [totalBudgetWei]);

  const roleCounts = useMemo(
    () => ({
      all: projects.length,
      client: projects.filter((project) => project.role === "client").length,
      freelancer: projects.filter(
        (project) => project.role === "freelancer"
      ).length,
      arbitrator: projects.filter(
        (project) => project.role === "arbitrator"
      ).length,
    }),
    [projects]
  );

  function handleRefresh() {
    void refreshProjects();
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <FolderKanban className="size-4" />
            ESCROW WORKSPACE
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Projects
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Manage your milestone-based escrow projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-black transition hover:bg-emerald-300"
          >
            <Plus className="size-4" />
            New project
          </Link>
        </div>
      </header>

      {!isConnected && (
        <section className="flex flex-col gap-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 size-5 shrink-0 text-amber-300" />
            <div>
              <h2 className="font-medium text-white">Connect your wallet</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Connect MetaMask to load projects associated with your wallet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void connectWallet()}
            disabled={isConnecting}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
          >
            {isConnecting && <Loader2 className="size-4 animate-spin" />}
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </button>
        </section>
      )}

      {isConnected && address && (
        <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="size-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Wallet connected
              </p>
              <p className="mt-1 font-mono text-xs text-zinc-400">
                {shortenAddress(address)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch(address);
              setRoleFilter("all");
            }}
            className="self-start text-xs text-emerald-300 hover:text-emerald-200 sm:self-auto"
          >
            Search my address
          </button>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#111114] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">Total projects</p>
            <FolderKanban className="size-5 text-emerald-300" />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">
            {isLoading ? "—" : projects.length}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Projects associated with your wallet
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111114] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">Milestones loaded</p>
            <BriefcaseBusiness className="size-5 text-sky-300" />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">
            {isLoading ? "—" : totalMilestones}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Across your loaded projects
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111114] p-5 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">Milestone value</p>
            <Wallet className="size-5 text-violet-300" />
          </div>
          <p className="mt-4 break-all text-3xl font-semibold text-white">
            {isLoading ? "—" : totalBudgetETH}
            <span className="ml-2 text-sm font-medium text-zinc-400">ETH</span>
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Sum of loaded milestone amounts
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Your projects
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Search projects and filter by your role.
            </p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID or wallet address..."
              aria-label="Search projects"
              className="h-11 w-full rounded-lg border border-white/10 bg-[#111114] pl-10 pr-10 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All projects"],
              ["client", "Client"],
              ["freelancer", "Freelancer"],
              ["arbitrator", "Arbitrator"],
            ] as [RoleFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRoleFilter(value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                roleFilter === value
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {label}
              <span className="text-xs opacity-70">
                {roleCounts[value]}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-300" />
              <div>
                <p className="text-sm font-medium text-red-200">
                  Unable to load projects
                </p>
                <p className="mt-1 break-words text-sm text-zinc-400">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
            >
              <RefreshCw className="size-4" />
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#111114] text-center">
            <Loader2 className="size-7 animate-spin text-emerald-300" />
            <p className="mt-4 text-sm font-medium text-white">
              Loading projects
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Fetching project data from the escrow service...
            </p>
          </div>
        ) : !isConnected ? (
          <div className="rounded-xl border border-white/10 bg-[#111114] px-6 py-16 text-center">
            <Wallet className="mx-auto size-8 text-zinc-600" />
            <h3 className="mt-4 font-medium text-white">
              Connect your wallet to continue
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Connect MetaMask to retrieve your client, freelancer, or
              arbitrator projects.
            </p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111114] px-6 py-16 text-center">
            <FolderKanban className="mx-auto size-9 text-zinc-600" />

            <h3 className="mt-4 font-medium text-white">
              {projects.length === 0
                ? "No projects found"
                : "No matching projects"}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
              {projects.length === 0
                ? "Projects associated with your wallet will appear here once they have been created on the configured escrow contract."
                : "Try another search term or role filter to find the project you're looking for."}
            </p>

            {projects.length === 0 ? (
              <Link
                href="/projects/new"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-300"
              >
                <Plus className="size-4" />
                Create your first project
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5"
              >
                <X className="size-4" />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                Showing {filteredProjects.length} of {projects.length} projects
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" />
                Sepolia testnet
              </span>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProjects.map((project) => {
                const projectMilestoneList = milestones[project.id] ?? [];

                const completedCount = projectMilestoneList.filter(
                  (milestone) =>
                    ["Paid", "Refunded", "Split"].includes(milestone.status)
                ).length;

                const progress =
                  projectMilestoneList.length > 0
                    ? Math.round(
                        (completedCount / projectMilestoneList.length) * 100
                      )
                    : 0;

                return (
                  <article
                    key={project.id}
                    className="group rounded-xl border border-white/10 bg-[#111114] p-5 transition hover:border-white/20 hover:bg-[#141418]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                          <FolderKanban className="size-5 text-emerald-300" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-semibold text-white">
                            Project #{project.id}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500">
                            Milestone-based escrow
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs capitalize text-emerald-300">
                        {project.role}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-500">Client</span>
                        <span
                          title={project.client}
                          className="max-w-[65%] break-all text-right font-mono text-xs text-zinc-300"
                        >
                          {shortenAddress(project.client)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-500">Freelancer</span>
                        <span
                          title={project.freelancer}
                          className="max-w-[65%] break-all text-right font-mono text-xs text-zinc-300"
                        >
                          {shortenAddress(project.freelancer)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/10 pt-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          Milestone progress
                        </span>
                        <span className="text-xs text-zinc-300">
                          {projectMilestoneList.length > 0
                            ? `${completedCount}/${projectMilestoneList.length}`
                            : "Not loaded"}
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">
                        {projectMilestoneList.length} milestones
                      </span>

                      <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-400/30 hover:bg-emerald-400/5 hover:text-emerald-300"
                      >
                        View project
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
