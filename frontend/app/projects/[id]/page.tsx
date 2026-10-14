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
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Coins,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Upload,
  UserRound,
  Wallet,
  Scale,
  ArrowUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

type PendingConfirmation = {
  message: string;
  action: () => void;
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

const DONE = ["Paid", "Refunded", "Split"];
const REVIEW_WINDOW = 7 * 24 * 60 * 60;
const DISPUTE_WINDOW = 30 * 24 * 60 * 60;

const panel = "rounded-xl border border-white/10 bg-[#111113]";

const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

const btnPrimary = `${btn} bg-emerald-400 text-black hover:bg-emerald-300`;
const btnOutline = `${btn} border border-white/10 text-zinc-200 hover:bg-white/5`;
const btnAmber = `${btn} border border-amber-400/20 text-amber-200 hover:bg-amber-400/5`;
const btnRed = `${btn} border border-red-400/20 text-red-200 hover:bg-red-400/5`;
const btnOrange = `${btn} border border-orange-400/20 text-orange-200 hover:bg-orange-400/5`;

const inputClass =
  "h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50 disabled:opacity-50";

const selectClass =
  "h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-[#111113] px-3 text-xs text-white outline-none focus:border-emerald-400/50 disabled:opacity-50";

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
  if (!timestamp) return "—";

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
    if (error.message.toLowerCase().includes("user rejected")) {
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
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "Submitted":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
    case "Disputed":
      return "border-red-400/20 bg-red-400/10 text-red-300";
    case "Refunded":
      return "border-zinc-400/20 bg-zinc-400/10 text-zinc-300";
    case "Revision Requested":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "Split":
      return "border-orange-400/20 bg-orange-400/10 text-orange-300";
    default:
      return "border-violet-400/20 bg-violet-400/10 text-violet-300";
  }
}

export default function ProjectDetailsPage({
  params,
}: ProjectDetailsPageProps) {
  const { id } = useParamsId(params);

  const {
    address,
    isConnected,
    isCorrectNetwork,
    connectWallet,
    isConnecting,
  } = useWallet();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [withdrawalBalance, setWithdrawalBalance] = useState("0");

  const [submissionURLs, setSubmissionURLs] = useState<Record<number, string>>(
    {},
  );
  const [revisionReasons, setRevisionReasons] = useState<
    Record<number, string>
  >({});
  const [disputeReasons, setDisputeReasons] = useState<Record<number, string>>(
    {},
  );
  const [resolveChoices, setResolveChoices] = useState<Record<number, string>>(
    {},
  );

  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null,
  );

  const getReadContract = useCallback(async () => {
    if (!CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)) {
      throw new Error(
        "The escrow contract address is not configured correctly.",
      );
    }

    let provider;

    if (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) {
      provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);
    } else if (window.ethereum) {
      provider = new BrowserProvider(window.ethereum);
    } else {
      throw new Error(
        "No Sepolia RPC URL is configured and MetaMask is not available.",
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
        "Your active MetaMask account changed. Refresh the page and try again.",
      );
    }

    return new Contract(CONTRACT_ADDRESS, ESCROW_ABI, signer);
  }, [address]);

  const loadProject = useCallback(async () => {
    if (!id) return;

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
        rawProject.remainingBalance ?? rawProject[3],
      );
      const milestoneCount = Number(rawProject.milestoneCount ?? rawProject[4]);
      const statusCode = Number(rawProject.status ?? rawProject[5]);

      if (!isAddress(client) || !isAddress(freelancer)) {
        throw new Error("This project does not exist or could not be loaded.");
      }

      const milestones: MilestoneData[] = [];

      for (let index = 0; index < milestoneCount; index++) {
        const rawMilestone = await contract.getMilestone(id, index);
        const milestoneStatusCode = Number(
          rawMilestone.status ?? rawMilestone[7],
        );

        milestones.push({
          index,
          description: String(rawMilestone.description ?? rawMilestone[0]),
          submissionURI: String(rawMilestone.submissionURI ?? rawMilestone[1]),
          amount: BigInt(rawMilestone.amount ?? rawMilestone[2]),
          deadline: Number(rawMilestone.deadline ?? rawMilestone[3]),
          submittedAt: Number(rawMilestone.submittedAt ?? rawMilestone[4]),
          disputedAt: Number(rawMilestone.disputedAt ?? rawMilestone[5]),
          revisionCount: Number(rawMilestone.revisionCount ?? rawMilestone[6]),
          statusCode: milestoneStatusCode,
          status: getStatus(milestoneStatusCode),
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
    !!address &&
    !!project &&
    address.toLowerCase() === project.client.toLowerCase();

  const isFreelancer =
    !!address &&
    !!project &&
    address.toLowerCase() === project.freelancer.toLowerCase();

  const isArbitrator =
    !!address &&
    !!project &&
    address.toLowerCase() === project.arbitrator.toLowerCase();

  const roleLabel = isClient
    ? "Client"
    : isFreelancer
      ? "Freelancer"
      : isArbitrator
        ? "Arbitrator"
        : "Viewer";

  const completedCount =
    project?.milestones.filter((milestone) => DONE.includes(milestone.status))
      .length ?? 0;

  const withdrawableLabel = Number(withdrawalBalance).toLocaleString("en-IN", {
    maximumFractionDigits: 6,
  });

  async function executeAction(
    action: (contract: Contract) => Promise<unknown>,
    successMessage: string,
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
      setConfirmation(null);
      setRefreshKey((current) => current + 1);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsActing(false);
    }
  }

  function submitWork(milestone: MilestoneData) {
    const uri = (submissionURLs[milestone.index] ?? "").trim();

    if (!uri) {
      setError("Please enter a submission URL.");
      return;
    }

    try {
      const parsedURL = new URL(uri);

      if (!["http:", "https:"].includes(parsedURL.protocol)) {
        setError("Enter a valid HTTP or HTTPS URL.");
        return;
      }
    } catch {
      setError("Please enter a valid URL, including https://");
      return;
    }

    void executeAction(
      (contract) => contract.submitWork(id, milestone.index, uri),
      "Work submitted successfully.",
    );
  }

  function requestRevision(milestone: MilestoneData) {
    const reason = (revisionReasons[milestone.index] ?? "").trim();

    if (!reason) {
      setError("Please enter a reason for requesting a revision.");
      return;
    }

    void executeAction(
      (contract) => contract.requestRevision(id, milestone.index, reason),
      "Revision requested successfully.",
    );
  }

  function raiseDispute(milestone: MilestoneData) {
    const reason = (disputeReasons[milestone.index] ?? "").trim();

    if (!reason) {
      setError("Please enter a reason for raising the dispute.");
      return;
    }

    void executeAction(
      (contract) => contract.raiseDispute(id, milestone.index),
      "Dispute raised successfully.",
    );
  }

  function resolveDispute(
    milestone: MilestoneData,
    outcome: "freelancer" | "client" | "split",
    splitPercentage = 50,
  ) {
    const amount = BigInt(milestone.amount);

    let freelancerAmount: bigint;

    switch (outcome) {
      case "freelancer":
        freelancerAmount = amount;
        break;

      case "client":
        freelancerAmount = BigInt(0);
        break;

      case "split":
        if (
          !Number.isFinite(splitPercentage) ||
          splitPercentage < 0 ||
          splitPercentage > 100
        ) {
          setError("Split percentage must be between 0 and 100.");
          return;
        }

        freelancerAmount =
          (amount * BigInt(Math.round(splitPercentage * 100))) / BigInt(10000);
        break;
    }

    void executeAction(
      (contract) =>
        contract.resolveDispute(id, milestone.index, freelancerAmount),
      "Dispute resolved successfully.",
    );
  }

  function askConfirmation(message: string, action: () => void) {
    setError("");
    setNotice("");
    setConfirmation({ message, action });
  }

  function approveMilestone(milestone: MilestoneData) {
    askConfirmation(
      `Approve milestone ${milestone.index + 1} and release ${formatETH(
        milestone.amount,
      )} ETH to the freelancer's pending withdrawal balance?`,
      () => {
        void executeAction(
          (contract) => contract.approveMilestone(id, milestone.index),
          "Milestone approved. The freelancer can now withdraw the released funds.",
        );
      },
    );
  }

  function refundMilestone(milestone: MilestoneData) {
    askConfirmation(
      `Refund milestone ${milestone.index + 1} to the client?`,
      () => {
        void executeAction(
          (contract) => contract.refundUnsubmitted(id, milestone.index),
          "Refund processed successfully.",
        );
      },
    );
  }

  function claimAfterTimeout(milestone: MilestoneData) {
    askConfirmation(
      `Claim payment for milestone ${milestone.index + 1} after the review period?`,
      () => {
        void executeAction(
          (contract) => contract.claimAfterReviewTimeout(id, milestone.index),
          "Payment claimed successfully.",
        );
      },
    );
  }

  function resolveExpiredDispute(milestone: MilestoneData) {
    askConfirmation(
      "The contract will split the disputed milestone amount equally after the dispute timeout. Continue?",
      () => {
        void executeAction(
          (contract) => contract.resolveExpiredDispute(id, milestone.index),
          "Expired dispute resolved successfully.",
        );
      },
    );
  }

  function withdrawFunds() {
    askConfirmation(
      `Withdraw ${withdrawableLabel} ETH to your connected wallet?`,
      () => {
        void executeAction(
          (contract) => contract.withdraw(),
          "Withdrawal completed successfully.",
        );
      },
    );
  }

  const actionsDisabled = isActing || !isCorrectNetwork;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Back to projects
          </Link>

          {id && <span className="text-xs text-zinc-500">Project #{id}</span>}

          {project && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                project.statusCode === 1
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : "border-sky-400/20 bg-sky-400/10 text-sky-300"
              }`}
            >
              {project.statusCode === 1 ? "Completed" : "Active"}
            </span>
          )}

          {address && project && (
            <span className="text-xs text-zinc-500">
              You: <span className="font-mono">{shortAddress(address)}</span>
              {" · "}
              {roleLabel}
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={isLoading || isActing}
          className="border-white/10 text-zinc-200"
        >
          <RefreshCw
            className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Wallet and network banners */}
      {!isConnected && (
        <section
          className={`${panel} flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
              <Wallet className="size-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Wallet not connected
              </h2>
              <p className="text-xs text-zinc-400">
                You can view this project, but you need a wallet to take
                actions.
              </p>
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
      )}

      {isConnected && !isCorrectNetwork && (
        <section className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-amber-200">
              Switch to Sepolia
            </p>
            <p className="text-xs text-zinc-400">
              Change your MetaMask network to Ethereum Sepolia to take actions.
            </p>
          </div>
        </section>
      )}

      {/* Error banner */}
      {error && (
        <section
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-300">
              Something went wrong
            </p>
            <p className="mt-0.5 break-words text-xs text-zinc-400">{error}</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={isLoading || isActing}
            className="shrink-0 border-white/10 text-zinc-200"
          >
            Retry
          </Button>
        </section>
      )}

      {/* Success banner */}
      {notice && (
        <section
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <p className="text-xs text-emerald-200">{notice}</p>
        </section>
      )}

      {/* Inline confirmation replaces window.confirm */}
      {confirmation && (
        <section
          role="alertdialog"
          aria-label="Confirm transaction"
          aria-modal="false"
          className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"
        >
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />

            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-amber-200">
                Confirm action
              </h2>

              <p className="mt-1 text-xs leading-5 text-zinc-300">
                {confirmation.message}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => {
                    const action = confirmation.action;
                    setConfirmation(null);
                    action();
                  }}
                  className={btnPrimary}
                >
                  Confirm
                </button>

                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => setConfirmation(null)}
                  className={btnOutline}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {isActing && (
        <section className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-xs text-sky-200">
          <Loader2 className="size-4 animate-spin" />
          Waiting for the transaction to be confirmed...
        </section>
      )}

      {isLoading && !project ? (
        <div
          className={`${panel} flex flex-col items-center px-5 py-14 text-center`}
        >
          <Loader2 className="size-6 animate-spin text-emerald-300" />
          <p className="mt-3 text-sm text-zinc-300">
            Loading project from the blockchain…
          </p>
        </div>
      ) : !project ? (
        <div className={`${panel} px-5 py-14 text-center`}>
          <FileText className="mx-auto size-8 text-zinc-600" />
          <h2 className="mt-3 text-sm font-medium text-white">
            Unable to load project
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-zinc-500">
            The project may not exist, the RPC may be unavailable, or the
            contract address may not be configured correctly.
          </p>
          <Button
            size="sm"
            onClick={() => setRefreshKey((current) => current + 1)}
            className="mt-4 bg-emerald-400 text-black hover:bg-emerald-300"
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <div className={`${panel} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">Total budget</p>
                <Coins className="size-4 text-violet-300" />
              </div>
              <p className="mt-2 break-words text-xl font-semibold text-white">
                {formatETH(project.totalBudget)}
                <span className="ml-1.5 text-xs font-medium text-zinc-400">
                  ETH
                </span>
              </p>
            </div>

            <div className={`${panel} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">Remaining in escrow</p>
                <CircleDollarSign className="size-4 text-emerald-300" />
              </div>
              <p className="mt-2 break-words text-xl font-semibold text-white">
                {formatETH(project.remainingBalance)}
                <span className="ml-1.5 text-xs font-medium text-zinc-400">
                  ETH
                </span>
              </p>
            </div>

            <div className={`${panel} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">Milestones done</p>
                <FileText className="size-4 text-sky-300" />
              </div>
              <p className="mt-2 text-xl font-semibold text-white">
                {completedCount}
                <span className="ml-1.5 text-xs font-medium text-zinc-400">
                  / {project.milestoneCount}
                </span>
              </p>
            </div>

            <div className={`${panel} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Your withdrawable balance
                </p>
                <Wallet className="size-4 text-amber-300" />
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="break-words text-xl font-semibold text-white">
                  {withdrawableLabel}
                  <span className="ml-1.5 text-xs font-medium text-zinc-400">
                    ETH
                  </span>
                </p>

                {Number(withdrawalBalance) > 0 && (
                  <button
                    type="button"
                    disabled={isActing || !isConnected || !isCorrectNetwork}
                    onClick={withdrawFunds}
                    className={btnPrimary}
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Participants */}
          <section className={`${panel} p-4 sm:p-5`}>
            <h2 className="text-sm font-semibold text-white">Participants</h2>
            <p className="text-xs text-zinc-400">
              Wallet addresses recorded by the escrow contract.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {[
                { label: "Client", value: project.client },
                { label: "Freelancer", value: project.freelancer },
                { label: "Arbitrator", value: project.arbitrator },
              ].map((participant) => (
                <div
                  key={participant.label}
                  className="min-w-0 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <UserRound className="size-3.5" />
                      {participant.label}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(participant.value)
                      }
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Copy
                    </button>
                  </div>

                  <p
                    className="mt-2 truncate font-mono text-xs text-zinc-200"
                    title={participant.value}
                  >
                    {shortAddress(participant.value)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Milestones */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Milestones</h2>
              <p className="text-xs text-zinc-400">
                Deliverables, deadlines, submissions and available actions.
              </p>
            </div>

            {project.milestones.length === 0 ? (
              <div className={`${panel} p-8 text-center text-xs text-zinc-400`}>
                No milestones were found for this project.
              </div>
            ) : (
              project.milestones.map((milestone) => {
                const now = Math.floor(Date.now() / 1000);

                const canSubmit =
                  isFreelancer &&
                  ["Funded", "Revision Requested"].includes(milestone.status);

                const canApprove = isClient && milestone.status === "Submitted";

                const canRequestRevision = canApprove;

                const canDispute =
                  (isClient || isFreelancer) &&
                  milestone.status === "Submitted" &&
                  milestone.submittedAt > 0 &&
                  now < milestone.submittedAt + REVIEW_WINDOW;

                const canClaimTimeout =
                  isFreelancer &&
                  milestone.status === "Submitted" &&
                  milestone.submittedAt > 0 &&
                  now >= milestone.submittedAt + REVIEW_WINDOW;

                const canRefund =
                  isClient &&
                  ["Funded", "Revision Requested"].includes(milestone.status) &&
                  milestone.deadline > 0 &&
                  now > milestone.deadline;

                const canResolveDispute =
                  isArbitrator && milestone.status === "Disputed";

                const canResolveExpired =
                  (isClient || isFreelancer) &&
                  milestone.status === "Disputed" &&
                  milestone.disputedAt > 0 &&
                  now >= milestone.disputedAt + DISPUTE_WINDOW;

                const hasActions =
                  canSubmit ||
                  canApprove ||
                  canRequestRevision ||
                  canDispute ||
                  canClaimTimeout ||
                  canRefund ||
                  canResolveDispute ||
                  canResolveExpired;

                return (
                  <article
                    key={milestone.index}
                    className={`${panel} p-4 sm:p-5`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-500">
                          Milestone {milestone.index + 1}
                        </p>
                        <h3 className="mt-1 break-words text-sm font-medium text-zinc-100">
                          {milestone.description}
                        </h3>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusStyles(
                          milestone.status,
                        )}`}
                      >
                        {milestone.status}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs text-zinc-500">Budget</dt>
                        <dd className="mt-1 text-sm font-semibold text-white">
                          {formatETH(milestone.amount)} ETH
                        </dd>
                      </div>

                      <div>
                        <dt className="flex items-center gap-1 text-xs text-zinc-500">
                          <Clock3 className="size-3" />
                          Deadline
                        </dt>
                        <dd className="mt-1 text-xs text-zinc-200">
                          {formatDate(milestone.deadline)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-zinc-500">Submitted</dt>
                        <dd className="mt-1 text-xs text-zinc-200">
                          {formatDate(milestone.submittedAt)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-zinc-500">
                          Revisions used
                        </dt>
                        <dd className="mt-1 text-xs text-zinc-200">
                          {milestone.revisionCount} / 3
                        </dd>
                      </div>
                    </dl>

                    {milestone.submissionURI && (
                      <a
                        href={milestone.submissionURI}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex max-w-full items-center gap-1.5 break-all text-xs text-sky-300 hover:text-sky-200"
                      >
                        <ExternalLink className="size-3.5 shrink-0" />
                        View submitted work
                      </a>
                    )}

                    {milestone.status === "Disputed" && (
                      <div className="mt-4 flex gap-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-200">
                        <ShieldAlert className="size-4 shrink-0" />
                        <p>
                          This milestone is disputed. Funds remain subject to
                          the contract&apos;s dispute resolution rules.
                        </p>
                      </div>
                    )}

                    {hasActions && (
                      <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                        {/* Submit work */}
                        {canSubmit && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              submitWork(milestone);
                            }}
                            className="flex flex-col gap-2 sm:flex-row"
                          >
                            <input
                              type="url"
                              value={submissionURLs[milestone.index] ?? ""}
                              onChange={(event) =>
                                setSubmissionURLs((current) => ({
                                  ...current,
                                  [milestone.index]: event.target.value,
                                }))
                              }
                              placeholder="https://github.com/username/project"
                              aria-label={`Submission URL for milestone ${milestone.index + 1}`}
                              required
                              disabled={actionsDisabled}
                              className={inputClass}
                            />

                            <button
                              type="submit"
                              disabled={
                                actionsDisabled ||
                                !(submissionURLs[milestone.index] ?? "").trim()
                              }
                              className={btnPrimary}
                            >
                              <Upload className="size-3.5" />
                              Submit work
                            </button>
                          </form>
                        )}
                        {/* Approve milestone */}
                        {canApprove && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => approveMilestone(milestone)}
                            className={btnPrimary}
                          >
                            <CheckCircle2 className="size-3.5" />
                            Approve &amp; release
                          </button>
                        )}
                        {/* Request revision */}
                        {canRequestRevision && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              requestRevision(milestone);
                            }}
                            className="flex flex-col gap-2 sm:flex-row"
                          >
                            <input
                              type="text"
                              value={revisionReasons[milestone.index] ?? ""}
                              onChange={(event) =>
                                setRevisionReasons((current) => ({
                                  ...current,
                                  [milestone.index]: event.target.value,
                                }))
                              }
                              placeholder="Explain what needs to be revised..."
                              aria-label={`Revision reason for milestone ${milestone.index + 1}`}
                              required
                              disabled={actionsDisabled}
                              className={inputClass}
                            />

                            <button
                              type="submit"
                              disabled={
                                actionsDisabled ||
                                !(revisionReasons[milestone.index] ?? "").trim()
                              }
                              className={btnAmber}
                            >
                              <RotateCcw className="size-3.5" />
                              Request revision
                            </button>
                          </form>
                        )}
                        {/* Raise dispute */}
                        {canDispute && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              raiseDispute(milestone);
                            }}
                            className="flex flex-col gap-2 sm:flex-row"
                          >
                            <input
                              type="text"
                              value={disputeReasons[milestone.index] ?? ""}
                              onChange={(event) =>
                                setDisputeReasons((current) => ({
                                  ...current,
                                  [milestone.index]: event.target.value,
                                }))
                              }
                              placeholder="Explain the reason for this dispute..."
                              aria-label={`Dispute reason for milestone ${milestone.index + 1}`}
                              required
                              disabled={actionsDisabled}
                              className={inputClass}
                            />

                            <button
                              type="submit"
                              disabled={
                                actionsDisabled ||
                                !(disputeReasons[milestone.index] ?? "").trim()
                              }
                              className={btnRed}
                            >
                              <ShieldAlert className="size-3.5" />
                              Raise dispute
                            </button>
                          </form>
                        )}
                        {/* Claim after review timeout */}
                        {canClaimTimeout && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => claimAfterTimeout(milestone)}
                            className={btnPrimary}
                          >
                            <CircleDollarSign className="size-3.5" />
                            Claim after review timeout
                          </button>
                        )}
                        {/* Refund */}
                        {canRefund && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => refundMilestone(milestone)}
                            className={btnOutline}
                          >
                            Refund unsubmitted work
                          </button>
                        )}
                        {/* Resolve dispute */}
                        {canResolveDispute &&
                          milestone.status === "Disputed" && (
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <p className="mb-3 text-sm font-medium text-white/80">
                                Resolve dispute
                              </p>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  onClick={() =>
                                    resolveDispute(milestone, "freelancer")
                                  }
                                  className="h-9 border border-emerald-500/30 bg-emerald-500/10 px-3 text-sm text-emerald-400 shadow-none hover:bg-emerald-500/20"
                                >
                                  Approve freelancer
                                </Button>

                                <Button
                                  onClick={() =>
                                    resolveDispute(milestone, "split", 50)
                                  }
                                  variant="outline"
                                  className="h-9 border-white/15 bg-transparent px-3 text-sm text-white/80 shadow-none hover:bg-white/[0.06] hover:text-white"
                                >
                                  Split 50/50
                                </Button>

                                <Button
                                  onClick={() =>
                                    resolveDispute(milestone, "client")
                                  }
                                  className="h-9 border border-rose-500/30 bg-rose-500/10 px-3 text-sm text-rose-400 shadow-none hover:bg-rose-500/20"
                                >
                                  Refund client
                                </Button>
                              </div>
                            </div>
                          )}

                        {/* Resolve expired dispute */}
                        {canResolveExpired && (
                          <button
                            type="button"
                            disabled={actionsDisabled}
                            onClick={() => resolveExpiredDispute(milestone)}
                            className={btnOrange}
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

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-zinc-500">
            <p>
              Data is read from the deployed escrow contract. Actions require
              MetaMask and Sepolia ETH for gas.
            </p>

            <a
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200"
            >
              View contract
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// Resolve Next.js dynamic route params.
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
