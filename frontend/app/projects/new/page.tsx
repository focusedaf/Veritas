
"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Wallet,
  CalendarDays,
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";
import {
  BrowserProvider,
  formatEther,
  isAddress,
  parseEther,
} from "ethers";

import { getEscrowContract } from "@/lib/contract";
import { useWallet } from "@/hooks/use-wallet";

type MilestoneDraft = {
  id: string;
  description: string;
  amount: string;
  deadline: string;
};

type CreatedProject = {
  id: string | null;
  hash: string;
};

const MAX_MILESTONES = 20;
const SEPOLIA_CHAIN_ID = 11155111;

function createMilestone(): MilestoneDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    description: "",
    amount: "",
    deadline: defaultDeadline(),
  };
}

function defaultDeadline(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function displayETH(value: bigint): string {
  return Number(formatEther(value)).toLocaleString("en-IN", {
    maximumFractionDigits: 6,
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("user rejected")) {
      return "You rejected the transaction in MetaMask.";
    }

    if (error.message.includes("insufficient funds")) {
      return "Your wallet does not have enough Sepolia ETH to cover the funding and gas fees.";
    }

    if (error.message.includes("Please switch MetaMask")) {
      return "Please switch MetaMask to the Sepolia test network.";
    }

    if (error.message.includes("MetaMask")) {
      return error.message;
    }

    return error.message.length > 300
      ? `${error.message.slice(0, 300)}...`
      : error.message;
  }

  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    const message = (error as { shortMessage?: unknown }).shortMessage;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Something went wrong while creating the project. Please try again.";
}

export default function NewProjectPage() {
  const {
    address,
    isConnected,
    isConnecting,
    connectWallet,
    isCorrectNetwork,
  } = useWallet();

  const [freelancer, setFreelancer] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    createMilestone(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdProject, setCreatedProject] =
    useState<CreatedProject | null>(null);

  const totalWei = useMemo(() => {
    try {
      if (milestones.some((milestone) => !milestone.amount.trim())) {
        return null;
      }

      return milestones.reduce(
        (total, milestone) => total + parseEther(milestone.amount.trim()),
        BigInt(0)
      );
    } catch {
      return null;
    }
  }, [milestones]);

  function updateMilestone(
    id: string,
    field: keyof Omit<MilestoneDraft, "id">,
    value: string
  ) {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.id === id
          ? { ...milestone, [field]: value }
          : milestone
      )
    );
  }

  function addMilestone() {
    if (milestones.length >= MAX_MILESTONES) {
      setError(`A project can have a maximum of ${MAX_MILESTONES} milestones.`);
      return;
    }

    setError("");
    setMilestones((current) => [...current, createMilestone()]);
  }

  function removeMilestone(id: string) {
    if (milestones.length <= 1) {
      setError("A project must have at least one milestone.");
      return;
    }

    setError("");
    setMilestones((current) =>
      current.filter((milestone) => milestone.id !== id)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreatedProject(null);

    if (!isConnected || !address) {
      setError("Connect your wallet before creating a project.");
      return;
    }

    if (!isCorrectNetwork) {
      setError("Please switch MetaMask to the Sepolia test network.");
      return;
    }

    const freelancerAddress = freelancer.trim();

    if (!isAddress(freelancerAddress)) {
      setError("Enter a valid freelancer wallet address.");
      return;
    }

    if (freelancerAddress.toLowerCase() === address.toLowerCase()) {
      setError("You cannot assign yourself as the freelancer.");
      return;
    }

    if (milestones.length === 0 || milestones.length > MAX_MILESTONES) {
      setError(`Add between 1 and ${MAX_MILESTONES} milestones.`);
      return;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);

    const descriptions: string[] = [];
    const amounts: bigint[] = [];
    const deadlines: bigint[] = [];

    try {
      for (let index = 0; index < milestones.length; index++) {
        const milestone = milestones[index];
        const description = milestone.description.trim();

        if (!description) {
          throw new Error(
            `Enter a description for milestone ${index + 1}.`
          );
        }

        if (description.length > 500) {
          throw new Error(
            `The description for milestone ${index + 1} must be 500 characters or fewer.`
          );
        }

        if (!milestone.amount.trim()) {
          throw new Error(
            `Enter an ETH amount for milestone ${index + 1}.`
          );
        }

        let amount: bigint;

        try {
          amount = parseEther(milestone.amount.trim());
        } catch {
          throw new Error(
            `Enter a valid ETH amount for milestone ${index + 1}, with no more than 18 decimal places.`
          );
        }

        if (amount <= BigInt(0)) {
          throw new Error(
            `Milestone ${index + 1} must have an amount greater than zero.`
          );
        }

        if (!milestone.deadline) {
          throw new Error(
            `Choose a deadline for milestone ${index + 1}.`
          );
        }

        const deadlineDate = new Date(milestone.deadline);

        if (Number.isNaN(deadlineDate.getTime())) {
          throw new Error(
            `Enter a valid deadline for milestone ${index + 1}.`
          );
        }

        const deadlineSeconds = Math.floor(
          deadlineDate.getTime() / 1000
        );

        if (deadlineSeconds <= nowInSeconds) {
          throw new Error(
            `The deadline for milestone ${index + 1} must be in the future.`
          );
        }

        descriptions.push(description);
        amounts.push(amount);
        deadlines.push(BigInt(deadlineSeconds));
      }

      const total = amounts.reduce((sum, amount) => sum + amount, BigInt(0));

      if (totalWei === null || total !== totalWei) {
        throw new Error("Unable to calculate the project funding total.");
      }

      setIsSubmitting(true);

      // Verify the currently active MetaMask account.
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install it to continue.");
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const actualAddress = await signer.getAddress();
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("Please switch MetaMask to the Sepolia test network.");
      }

      if (actualAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error(
          "Your active MetaMask account changed. Refresh the page and try again."
        );
      }

      if (actualAddress.toLowerCase() === freelancerAddress.toLowerCase()) {
        throw new Error("You cannot assign yourself as the freelancer.");
      }

      const contract = await getEscrowContract();

      // The contract owner/arbitrator cannot be the client or freelancer.
      const arbitratorAddress = (await contract.arbitrator()) as string;

      if (
        actualAddress.toLowerCase() === arbitratorAddress.toLowerCase()
      ) {
        throw new Error(
          "The contract arbitrator cannot create a project as the client."
        );
      }

      if (
        freelancerAddress.toLowerCase() === arbitratorAddress.toLowerCase()
      ) {
        throw new Error(
          "The contract arbitrator cannot be assigned as the freelancer."
        );
      }

      // Submit the transaction and lock the complete milestone budget.
      const transaction = await contract.createProject(
        freelancerAddress,
        descriptions,
        amounts,
        deadlines,
        { value: total }
      );

      const receipt = await transaction.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error("The project creation transaction failed on-chain.");
      }

      // Read the new project ID from the ProjectCreated event.
      let projectId: string | null = null;

      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed?.name === "ProjectCreated") {
            const eventClient = String(parsed.args.client);

            if (eventClient.toLowerCase() === actualAddress.toLowerCase()) {
              projectId = String(parsed.args.projectId);
              break;
            }
          }
        } catch {
          // Ignore logs emitted by other contracts.
        }
      }

      setCreatedProject({
        id: projectId,
        hash: transaction.hash,
      });
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdProject) {
    return (
      <main className="min-h-screen bg-[#09090b] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/30 bg-[#111114] p-6 sm:p-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>

          <h1 className="text-2xl font-semibold">Project created successfully</h1>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Your transaction has been confirmed on Sepolia. The project budget
            is now locked in the escrow contract according to its rules.
          </p>

          {createdProject.id && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-zinc-400">Project ID</p>
              <p className="mt-1 break-all text-lg font-semibold">
                #{createdProject.id}
              </p>
            </div>
          )}

          <a
            href={`https://sepolia.etherscan.io/tx/${createdProject.hash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200"
          >
            View transaction on Etherscan
            <ExternalLink className="h-4 w-4" />
          </a>

          <div className="mt-8 flex flex-wrap gap-3">
            {createdProject.id && (
              <Link
                href={`/projects/${createdProject.id}`}
                className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium hover:bg-violet-500"
              >
                View project
              </Link>
            )}

            <Link
              href="/projects"
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5"
            >
              All projects
            </Link>

            <button
              type="button"
              onClick={() => {
                setCreatedProject(null);
                setFreelancer("");
                setMilestones([createMilestone()]);
                setError("");
              }}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5"
            >
              Create another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/projects"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>

        <div className="mb-8">
          <p className="text-sm font-medium text-violet-400">ESCROW MANAGEMENT</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Create a project
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Define the work, assign a freelancer, and divide the budget into
            milestones. The total budget will be deposited into the escrow
            contract when you confirm the transaction.
          </p>
        </div>

        {!isConnected ? (
          <section className="mb-6 flex flex-col gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <h2 className="font-medium">Wallet not connected</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Connect MetaMask to create and fund an escrow project.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void connectWallet()}
              disabled={isConnecting}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          </section>
        ) : !isCorrectNetwork ? (
          <section className="mb-6 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <h2 className="font-medium">Switch to Sepolia</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Your wallet is connected, but it is not on the Sepolia test
                network. Switch networks in MetaMask before creating the project.
              </p>
            </div>
          </section>
        ) : (
          <section className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Wallet connected to Sepolia
            </div>
            <p className="mt-2 break-all font-mono text-xs text-zinc-400">
              {address}
            </p>
          </section>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-[#111114] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Wallet className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <h2 className="font-semibold">Freelancer details</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Specify the wallet that will complete the work.
                </p>
              </div>
            </div>

            <label
              htmlFor="freelancer"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Freelancer wallet address
            </label>
            <input
              id="freelancer"
              type="text"
              value={freelancer}
              onChange={(event) => setFreelancer(event.target.value)}
              placeholder="0x..."
              autoComplete="off"
              spellCheck={false}
              required
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500"
            />
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Double-check this address before submitting. Transactions on the
              blockchain cannot simply be reversed.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#111114] p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                  <FileText className="h-5 w-5 text-sky-300" />
                </div>
                <div>
                  <h2 className="font-semibold">Project milestones</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Break the work into deliverables with individual budgets.
                  </p>
                </div>
              </div>

              <span className="text-sm text-zinc-500">
                {milestones.length}/{MAX_MILESTONES}
              </span>
            </div>

            <div className="space-y-4">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-medium">
                      Milestone {index + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeMilestone(milestone.id)}
                      disabled={milestones.length === 1 || isSubmitting}
                      aria-label={`Remove milestone ${index + 1}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor={`description-${milestone.id}`}
                        className="mb-2 block text-sm text-zinc-300"
                      >
                        Description
                      </label>
                      <textarea
                        id={`description-${milestone.id}`}
                        value={milestone.description}
                        onChange={(event) =>
                          updateMilestone(
                            milestone.id,
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Describe the work or deliverable..."
                        rows={3}
                        maxLength={500}
                        required
                        disabled={isSubmitting}
                        className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500 disabled:opacity-60"
                      />
                      <p className="mt-1 text-right text-xs text-zinc-600">
                        {milestone.description.length}/500
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`amount-${milestone.id}`}
                          className="mb-2 block text-sm text-zinc-300"
                        >
                          Budget (ETH)
                        </label>
                        <div className="relative">
                          <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            id={`amount-${milestone.id}`}
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            value={milestone.amount}
                            onChange={(event) =>
                              updateMilestone(
                                milestone.id,
                                "amount",
                                event.target.value
                              )
                            }
                            placeholder="0.05"
                            required
                            disabled={isSubmitting}
                            className="w-full rounded-lg border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500 disabled:opacity-60"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`deadline-${milestone.id}`}
                          className="mb-2 block text-sm text-zinc-300"
                        >
                          Deadline
                        </label>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            id={`deadline-${milestone.id}`}
                            type="datetime-local"
                            value={milestone.deadline}
                            min={defaultDeadline().slice(0, 16)}
                            onChange={(event) =>
                              updateMilestone(
                                milestone.id,
                                "deadline",
                                event.target.value
                              )
                            }
                            required
                            disabled={isSubmitting}
                            className="w-full min-w-0 rounded-lg border border-white/10 bg-black/20 py-3 pl-10 pr-2 text-sm text-zinc-200 outline-none transition focus:border-violet-500 disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMilestone}
              disabled={
                milestones.length >= MAX_MILESTONES || isSubmitting
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-violet-500/50 hover:bg-violet-500/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add milestone
            </button>
          </section>

          <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                <Coins className="h-5 w-5 text-violet-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Total project funding</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  The sum of all milestone budgets will be sent to the escrow
                  contract in one transaction.
                </p>
                <p className="mt-4 break-all text-3xl font-semibold tracking-tight">
                  {totalWei === null ? "—" : displayETH(totalWei)}
                  <span className="ml-2 text-base font-medium text-zinc-400">
                    ETH
                  </span>
                </p>
                {totalWei !== null && (
                  <p className="mt-2 break-all text-xs text-zinc-500">
                    {totalWei.toString()} wei
                  </p>
                )}
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  You will also need Sepolia ETH to pay the transaction gas fee.
                  Review all addresses, milestone budgets, and deadlines before
                  confirming in MetaMask.
                </p>
              </div>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-lg border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !isConnected ||
                !isCorrectNetwork ||
                totalWei === null
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {`Waiting for confirmation...`}
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Create and fund project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
