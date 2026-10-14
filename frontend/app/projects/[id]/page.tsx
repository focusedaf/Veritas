
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  isAddress,
} from "ethers";
import {
  ArrowLeft,
  ExternalLink,
  Wallet,
  RefreshCw,
  Clock3,
  Coins,
  UserRound,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Upload,
  RotateCcw,
  CircleDollarSign,
} from "lucide-react";

import { useWallet } from "@/hooks/use-wallet";
import { CONTRACT_ADDRESS, ESCROW_ABI } from "@/lib/contract";

type MilestoneStatus =
  | "Funded"
  | "Submitted"
  | "Disputed"
  | "Paid"
  | "Refunded"
  | "Revision Requested"
  | "Split"
  | "Unknown";

type MilestoneData = {
  index: number;
  description: string;
  submissionURI: string;
  amount: bigint;
  deadline: number;
  submittedAt: number;
  disputedAt: number;
  revisionCount: number;
  statusCode: number;
  status: MilestoneStatus;
};

type ProjectData = {
  id: string;
  client: string;
  freelancer: string;
  totalBudget: bigint;
  remainingBalance: bigint;
  milestoneCount: number;
  statusCode: number;
  arbitrator: string;
  milestones: MilestoneData[];
};

type ProjectDetailsPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_NAMES: MilestoneStatus[] = [
  "Funded",
  "Submitted",
  "Disputed",
  "Paid",
  "Refunded",
  "Revision Requested",
  "Split",
];

function getStatus(statusCode: number): MilestoneStatus {
  return STATUS_NAMES[statusCode] ?? "Unknown";
}

function shortAddress(address: string): string {
  if (!address || !isAddress(address)) return address || "Unavailable";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatETH(value: bigint): string {
  return Number(formatEther(value)).toLocaleString("en-IN", {
    maximumFractionDigits: 6,
  });
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "Not available";

  return new Date(timestamp * 1000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    if ("code" in error && error.code === 4001) {
      return "You rejected the transaction in MetaMask.";
    }

    if ("shortMessage" in error && typeof error.shortMessage === "string") {
      return error.shortMessage;
    }

    if ("reason" in error && typeof error.reason === "string") {
      return error.reason;
    }
  }

  if (error instanceof Error) {
    if (error.message.includes("user rejected")) {
      return "You rejected the transaction in MetaMask.";
    }

    return error.message.length > 300
      ? `${error.message.slice(0, 300)}...`
      : error.message;
  }

  return "Something went wrong. Please try again.";
}

function statusStyles(status: MilestoneStatus): string {
  switch (status) {
    case "Paid":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "Submitted":
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";
    case "Disputed":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "Refunded":
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
    case "Revision Requested":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "Split":
      return "border-orange-500/20 bg-orange-500/10 text-orange-300";
    default:
      return "border-violet-500/20 bg-violet-500/10 text-violet-300";
  }
}

export default function ProjectDetailsPage({
  params,
}: ProjectDetailsPageProps) {
  const { id } = useParamsId(params);
  const { address, isConnected, isCorrectNetwork, connectWallet } = useWallet();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [withdrawalBalance, setWithdrawalBalance] = useState("0");

  const getReadContract = useCallback(async () => {
    if (!CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)) {
      throw new Error("The escrow contract address is not configured correctly.");
    }

    let provider;

    if (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) {
      provider = new JsonRpcProvider(
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL
      );
    } else if (window.ethereum) {
      provider = new BrowserProvider(window.ethereum);
    } else {
      throw new Error(
        "No Sepolia RPC URL is configured and MetaMask is not available."
      );
    }

    return new Contract(CONTRACT_ADDRESS, ESCROW_ABI, provider);
  }, []);

  const getWriteContract = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask to perform this action.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== 11155111) {
      throw new Error("Please switch MetaMask to the Sepolia test network.");
    }

    const signer = await provider.getSigner();

    if (
      address &&
      (await signer.getAddress()).toLowerCase() !== address.toLowerCase()
    ) {
      throw new Error(
        "Your active MetaMask account changed. Refresh the page and try again."
      );
    }

    return new Contract(CONTRACT_ADDRESS, ESCROW_ABI, signer);
  }, [address]);

  const loadProject = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (!/^\d+$/.test(id) || BigInt(id) <= BigInt(0)) {
        throw new Error("The project ID is invalid.");
      }

      const contract = await getReadContract();

      const [rawProject, arbitrator] = await Promise.all([
        contract.projects(id),
        contract.arbitrator(),
      ]);

      const client = String(rawProject.client ?? rawProject[0]);
      const freelancer = String(rawProject.freelancer ?? rawProject[1]);
      const totalBudget = BigInt(rawProject.totalBudget ?? rawProject[2]);
      const remainingBalance = BigInt(
        rawProject.remainingBalance ?? rawProject[3]
      );
      const milestoneCount = Number(
        rawProject.milestoneCount ?? rawProject[4]
      );
      const statusCode = Number(rawProject.status ?? rawProject[5]);

      if (!isAddress(client) || !isAddress(freelancer)) {
        throw new Error("This project does not exist or could not be loaded.");
      }

      const milestones: MilestoneData[] = [];

      for (let index = 0; index < milestoneCount; index++) {
        const rawMilestone = await contract.getMilestone(id, index);

        milestones.push({
          index,
          description: String(
            rawMilestone.description ?? rawMilestone[0]
          ),
          submissionURI: String(
            rawMilestone.submissionURI ?? rawMilestone[1]
          ),
          amount: BigInt(rawMilestone.amount ?? rawMilestone[2]),
          deadline: Number(rawMilestone.deadline ?? rawMilestone[3]),
          submittedAt: Number(rawMilestone.submittedAt ?? rawMilestone[4]),
          disputedAt: Number(rawMilestone.disputedAt ?? rawMilestone[5]),
          revisionCount: Number(
            rawMilestone.revisionCount ?? rawMilestone[6]
          ),
          statusCode: Number(rawMilestone.status ?? rawMilestone[7]),
          status: getStatus(Number(rawMilestone.status ?? rawMilestone[7])),
        });
      }

      setProject({
        id,
        client,
        freelancer,
        totalBudget,
        remainingBalance,
        milestoneCount,
        statusCode,
        arbitrator: String(arbitrator),
        milestones,
      });

      if (address && isAddress(address)) {
        const pending = await contract.pendingWithdrawals(address);
        setWithdrawalBalance(formatEther(BigInt(pending)));
      } else {
        setWithdrawalBalance("0");
      }
    } catch (loadError) {
      setProject(null);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [address, getReadContract, id]);

  useEffect(() => {
    void loadProject();
  }, [loadProject, refreshKey]);

  const isClient =
    !!address && !!project &&
    address.toLowerCase() === project.client.toLowerCase();

  const isFreelancer =
    !!address && !!project &&
    address.toLowerCase() === project.freelancer.toLowerCase();

  const isArbitrator =
    !!address && !!project &&
    address.toLowerCase() === project.arbitrator.toLowerCase();

  const completedCount =
    project?.milestones.filter((milestone) =>
      ["Paid", "Refunded", "Split"].includes(milestone.status)
    ).length ?? 0;

  async function executeAction(
    action: (contract: Contract) => Promise<unknown>,
    successMessage: string
  ) {
    setError("");
    setNotice("");

    if (!isConnected || !address) {
      setError("Connect your wallet before performing this action.");
      return;
    }

    if (!isCorrectNetwork) {
      setError("Please switch MetaMask to the Sepolia test network.");
      return;
    }

    setIsActing(true);

    try {
      const contract = await getWriteContract();
      const transaction = await action(contract);

      if (
        typeof transaction !== "object" ||
        transaction === null ||
        !("wait" in transaction) ||
        typeof transaction.wait !== "function"
      ) {
        throw new Error("The transaction could not be submitted.");
      }

      const receipt = await transaction.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error("The transaction failed on-chain.");
      }

      setNotice(successMessage);
      setRefreshKey((current) => current + 1);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsActing(false);
    }
  }

  function submitWork(milestone: MilestoneData) {
    const uri = window.prompt(
      "Enter the URL for your completed work (for example, a GitHub, Google Drive, or project demo link):"
    );

    if (uri === null) return;

    if (!uri.trim()) {
      setError("A submission URL is required.");
      return;
    }

    void executeAction(
      (contract) =>
        contract.submitWork(id, milestone.index, uri.trim()),
      "Work submitted successfully."
    );
  }

  function requestRevision(milestone: MilestoneData) {
    const reason = window.prompt(
      "Explain what needs to be revised:"
    );

    if (reason === null) return;

    if (!reason.trim()) {
      setError("A revision reason is required.");
      return;
    }

    void executeAction(
      (contract) =>
        contract.requestRevision(id, milestone.index, reason.trim()),
      "Revision requested successfully."
    );
  }

  function raiseDispute(milestone: MilestoneData) {
    const confirmed = window.confirm(
      `Raise a dispute for milestone ${milestone.index + 1}? This will change the milestone status on-chain.`
    );

    if (!confirmed) return;

    void executeAction(
      (contract) => contract.raiseDispute(id, milestone.index),
      "Dispute raised successfully."
    );
  }

  function approveMilestone(milestone: MilestoneData) {
    const confirmed = window.confirm(
      `Approve milestone ${milestone.index + 1} and release ${formatETH(milestone.amount)} ETH to the freelancer's pending withdrawal balance?`
    );

    if (!confirmed) return;

    void executeAction(
      (contract) => contract.approveMilestone(id, milestone.index),
      "Milestone approved. The freelancer can now withdraw the released funds."
    );
  }

  function refundMilestone(milestone: MilestoneData) {
    const confirmed = window.confirm(
      `Refund milestone ${milestone.index + 1} to the client? This action is only available after the deadline for eligible unsubmitted work.`
    );

    if (!confirmed) return;

    void executeAction(
      (contract) => contract.refundUnsubmitted(id, milestone.index),
      "Refund processed successfully."
    );
  }

  function claimAfterTimeout(milestone: MilestoneData) {
    const confirmed = window.confirm(
      `Claim payment for milestone ${milestone.index + 1} after the review period?`
    );

    if (!confirmed) return;

    void executeAction(
      (contract) =>
        contract.claimAfterReviewTimeout(id, milestone.index),
      "Payment claimed successfully."
    );
  }

  function resolveExpiredDispute(milestone: MilestoneData) {
    const confirmed = window.confirm(
      "The contract will split the disputed milestone amount equally after the dispute timeout. Continue?"
    );

    if (!confirmed) return;

    void executeAction(
      (contract) =>
        contract.resolveExpiredDispute(id, milestone.index),
      "Expired dispute resolved successfully."
    );
  }

  function resolveDispute(milestone: MilestoneData) {
    const rawAmount = window.prompt(
      `Enter the ETH amount to award to the freelancer. Maximum: ${formatETH(milestone.amount)} ETH. The remainder goes to the client.`,
      formatETH(milestone.amount)
    );

    if (rawAmount === null) return;

    void (async () => {
      try {
        const { parseEther } = await import("ethers");
        const amount = parseEther(rawAmount.trim());

        if (amount < BigInt(0) || amount > milestone.amount) {
          setError("The award must be between zero and the milestone amount.");
          return;
        }

        void executeAction(
          (contract) =>
            contract.resolveDispute(id, milestone.index, amount),
          "Dispute resolved successfully."
        );
      } catch {
        setError("Enter a valid ETH amount.");
      }
    })();
  }

  function withdrawFunds() {
    const confirmed = window.confirm(
      `Withdraw ${Number(withdrawalBalance).toLocaleString("en-IN", {
        maximumFractionDigits: 6,
      })} ETH to your connected wallet?`
    );

    if (!confirmed) return;

    void executeAction(
      (contract) => contract.withdraw(),
      "Withdrawal completed successfully."
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>

          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={isLoading || isActing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <header>
          <p className="text-sm font-medium text-violet-400">
            VERITAS ESCROW
          </p>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">
            Project #{id}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Project details, milestone progress, and escrow actions.
          </p>
        </header>

        {!isConnected && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div>
              <p className="font-medium text-amber-200">
                Wallet not connected
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                You can view project details, but a wallet is needed for actions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void connectWallet()}
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium hover:bg-violet-500"
            >
              Connect wallet
            </button>
          </div>
        )}

        {isConnected && !isCorrectNetwork && (
          <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium text-amber-200">
                Switch to Sepolia
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Switch your MetaMask network to Sepolia to perform contract actions.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        {isActing && (
          <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-violet-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            Waiting for the blockchain transaction to be confirmed...
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading project from the blockchain...
          </div>
        ) : !project ? (
          <div className="rounded-2xl border border-white/10 bg-[#111114] px-6 py-16 text-center">
            <FileText className="mx-auto h-9 w-9 text-zinc-600" />
            <h2 className="mt-4 text-lg font-medium">
              Unable to load project
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              The project may not exist, the RPC may be unavailable, or the
              contract address may not be configured correctly.
            </p>
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="mt-5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium hover:bg-violet-500"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-[#111114] p-5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Coins className="h-4 w-4 text-violet-300" />
                  Total budget
                </div>
                <p className="mt-3 break-words text-2xl font-semibold">
                  {formatETH(project.totalBudget)}{" "}
                  <span className="text-sm font-medium text-zinc-400">ETH</span>
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#111114] p-5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <CircleDollarSign className="h-4 w-4 text-emerald-300" />
                  Remaining escrow
                </div>
                <p className="mt-3 break-words text-2xl font-semibold">
                  {formatETH(project.remainingBalance)}{" "}
                  <span className="text-sm font-medium text-zinc-400">ETH</span>
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#111114] p-5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <FileText className="h-4 w-4 text-sky-300" />
                  Milestones
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {completedCount}
                  <span className="ml-1 text-sm font-medium text-zinc-400">
                    / {project.milestoneCount} completed
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#111114] p-5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Wallet className="h-4 w-4 text-amber-300" />
                  Your withdrawable balance
                </div>
                <p className="mt-3 break-words text-2xl font-semibold">
                  {Number(withdrawalBalance).toLocaleString("en-IN", {
                    maximumFractionDigits: 6,
                  })}{" "}
                  <span className="text-sm font-medium text-zinc-400">ETH</span>
                </p>
                {Number(withdrawalBalance) > 0 && (
                  <button
                    type="button"
                    disabled={isActing || !isConnected || !isCorrectNetwork}
                    onClick={withdrawFunds}
                    className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
                  >
                    Withdraw funds
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#111114] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Project participants</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    These wallet addresses are recorded by the escrow contract.
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    project.statusCode === 1
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-violet-500/20 bg-violet-500/10 text-violet-300"
                  }`}
                >
                  {project.statusCode === 1 ? "Completed" : "Active"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {[
                  { label: "Client", value: project.client },
                  { label: "Freelancer", value: project.freelancer },
                  { label: "Arbitrator", value: project.arbitrator },
                ].map((participant) => (
                  <div
                    key={participant.label}
                    className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <UserRound className="h-4 w-4" />
                      {participant.label}
                    </div>
                    <p className="mt-3 break-all font-mono text-sm">
                      {participant.value}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(participant.value)
                      }
                      className="mt-3 text-xs text-violet-300 hover:text-violet-200"
                    >
                      Copy address
                    </button>
                  </div>
                ))}
              </div>

              {address && (
                <p className="mt-5 text-sm text-zinc-400">
                  Connected as{" "}
                  <span className="font-mono text-zinc-200">
                    {shortAddress(address)}
                  </span>
                  {" — "}
                  {isClient
                    ? "Client"
                    : isFreelancer
                      ? "Freelancer"
                      : isArbitrator
                        ? "Arbitrator"
                        : "Viewer"}
                </p>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Milestones</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Review deliverables, deadlines, submission links, and available actions.
                </p>
              </div>

              {project.milestones.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#111114] p-8 text-center text-sm text-zinc-400">
                  No milestones were found for this project.
                </div>
              ) : (
                project.milestones.map((milestone) => {
                  const canSubmit =
                    isFreelancer &&
                    ["Funded", "Revision Requested"].includes(milestone.status);

                  const canApprove = isClient && milestone.status === "Submitted";

                  const canRequestRevision =
                    isClient && milestone.status === "Submitted";

                  const canDispute =
                    (isClient || isFreelancer) &&
                    milestone.status === "Submitted" &&
                    milestone.submittedAt > 0 &&
                    Math.floor(Date.now() / 1000) <
                      milestone.submittedAt + 7 * 24 * 60 * 60;

                  const canClaimTimeout =
                    isFreelancer &&
                    milestone.status === "Submitted" &&
                    milestone.submittedAt > 0 &&
                    Math.floor(Date.now() / 1000) >=
                      milestone.submittedAt + 7 * 24 * 60 * 60;

                  const canRefund =
                    isClient &&
                    ["Funded", "Revision Requested"].includes(
                      milestone.status
                    ) &&
                    milestone.deadline > 0 &&
                    Math.floor(Date.now() / 1000) > milestone.deadline;

                  const canResolveDispute =
                    isArbitrator && milestone.status === "Disputed";

                  const canResolveExpired =
                    (isClient || isFreelancer) &&
                    milestone.status === "Disputed" &&
                    milestone.disputedAt > 0 &&
                    Math.floor(Date.now() / 1000) >=
                      milestone.disputedAt + 30 * 24 * 60 * 60;

                  return (
                    <article
                      key={milestone.index}
                      className="rounded-2xl border border-white/10 bg-[#111114] p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                            Milestone {milestone.index + 1}
                          </p>
                          <h3 className="mt-2 break-words text-lg font-semibold">
                            {milestone.description}
                          </h3>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusStyles(
                            milestone.status
                          )}`}
                        >
                          {milestone.status}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs text-zinc-500">Milestone budget</p>
                          <p className="mt-1 font-semibold">
                            {formatETH(milestone.amount)} ETH
                          </p>
                        </div>

                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Clock3 className="h-3.5 w-3.5" />
                            Deadline
                          </p>
                          <p className="mt-1 text-sm text-zinc-200">
                            {formatDate(milestone.deadline)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-zinc-500">Submitted at</p>
                          <p className="mt-1 text-sm text-zinc-200">
                            {formatDate(milestone.submittedAt)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-zinc-500">Revisions used</p>
                          <p className="mt-1 text-sm text-zinc-200">
                            {milestone.revisionCount} / 3
                          </p>
                        </div>
                      </div>

                      {milestone.submissionURI && (
                        <a
                          href={milestone.submissionURI}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-5 inline-flex max-w-full items-center gap-2 break-all text-sm text-sky-300 hover:text-sky-200"
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" />
                          View submitted work
                        </a>
                      )}

                      {milestone.status === "Disputed" && (
                        <div className="mt-5 flex gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-200">
                          <ShieldAlert className="h-5 w-5 shrink-0" />
                          <p>
                            This milestone is disputed. Funds remain subject to
                            the contract's dispute resolution rules.
                          </p>
                        </div>
                      )}

                      {(canSubmit ||
                        canApprove ||
                        canRequestRevision ||
                        canDispute ||
                        canClaimTimeout ||
                        canRefund ||
                        canResolveDispute ||
                        canResolveExpired) && (
                        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                          {canSubmit && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => submitWork(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2.5 text-sm font-medium hover:bg-violet-500 disabled:opacity-40"
                            >
                              <Upload className="h-4 w-4" />
                              Submit work
                            </button>
                          )}

                          {canApprove && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => approveMilestone(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve & release
                            </button>
                          )}

                          {canRequestRevision && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => requestRevision(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 px-3.5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/5 disabled:opacity-40"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Request revision
                            </button>
                          )}

                          {canDispute && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => raiseDispute(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3.5 py-2.5 text-sm font-medium text-red-200 hover:bg-red-500/5 disabled:opacity-40"
                            >
                              <ShieldAlert className="h-4 w-4" />
                              Raise dispute
                            </button>
                          )}

                          {canClaimTimeout && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => claimAfterTimeout(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
                            >
                              <CircleDollarSign className="h-4 w-4" />
                              Claim after review timeout
                            </button>
                          )}

                          {canRefund && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => refundMilestone(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-40"
                            >
                              Refund unsubmitted work
                            </button>
                          )}

                          {canResolveDispute && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => resolveDispute(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2.5 text-sm font-medium hover:bg-violet-500 disabled:opacity-40"
                            >
                              Resolve dispute
                            </button>
                          )}

                          {canResolveExpired && (
                            <button
                              type="button"
                              disabled={isActing || !isCorrectNetwork}
                              onClick={() => resolveExpiredDispute(milestone)}
                              className="inline-flex items-center gap-2 rounded-lg border border-orange-500/20 px-3.5 py-2.5 text-sm font-medium text-orange-200 hover:bg-orange-500/5 disabled:opacity-40"
                            >
                              Split expired dispute
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-zinc-500">
              <p>
                Project data is read from the deployed escrow contract. Actions
                require MetaMask and Sepolia ETH for gas.
              </p>
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-violet-300 hover:text-violet-200"
              >
                View contract
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// Resolve Next.js dynamic route params without using hooks in the page body.
function useParamsId(params: Promise<{ id: string }>) {
  const [id, setId] = useState("");

  useEffect(() => {
    let active = true;

    void params.then(({ id: routeId }) => {
      if (active) setId(routeId);
    });

    return () => {
      active = false;
    };
  }, [params]);

  return { id };
}
