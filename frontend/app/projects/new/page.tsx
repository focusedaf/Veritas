"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Coins,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { BrowserProvider, isAddress, parseEther } from "ethers";

import { Button } from "@/components/ui/button";
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

const panel = "rounded-xl border border-white/10 bg-[#111113]";
const inputClass =
  "w-full rounded-md border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/50 disabled:opacity-60";

// Format a Date as the local "YYYY-MM-DDTHH:mm" string datetime-local expects.
function toLocalInput(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function createMilestone(): MilestoneDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    description: "",
    amount: "",
    deadline: "",
  };
}

// Keep only digits and a single dot, with at most 18 decimal places.
function sanitizeAmount(raw: string): string {
  let value = raw.replace(/[^0-9.]/g, "");

  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    const whole = value.slice(0, firstDot);
    const fraction = value
      .slice(firstDot + 1)
      .replace(/\./g, "")
      .slice(0, 18);
    value = `${whole}.${fraction}`;
  }

  return value;
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
    error: walletError,
  } = useWallet();

  const [freelancer, setFreelancer] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    createMilestone(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdProject, setCreatedProject] = useState<CreatedProject | null>(
    null,
  );

  // Inline feedback for the freelancer field, shown while typing.
  const freelancerHint = useMemo(() => {
    const value = freelancer.trim();
    if (!value) return "";
    if (!isAddress(value)) return "This isn't a valid wallet address.";
    if (address && value.toLowerCase() === address.toLowerCase()) {
      return "You can't assign yourself as the freelancer.";
    }
    return "";
  }, [freelancer, address]);

  function updateMilestone(
    id: string,
    field: keyof Omit<MilestoneDraft, "id">,
    value: string,
  ) {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.id === id ? { ...milestone, [field]: value } : milestone,
      ),
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
      current.filter((milestone) => milestone.id !== id),
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
        const label = `Milestone ${index + 1}`;
        const description = milestone.description.trim();

        if (!description) {
          throw new Error(`${label}: enter a description.`);
        }

        if (description.length > 500) {
          throw new Error(
            `${label}: description must be 500 characters or fewer.`,
          );
        }

        const rawAmount = milestone.amount.trim();

        if (!rawAmount || rawAmount === ".") {
          throw new Error(`${label}: enter an ETH amount.`);
        }

        let amount: bigint;

        try {
          amount = parseEther(rawAmount);
        } catch {
          throw new Error(`${label}: enter a valid ETH amount.`);
        }

        if (amount <= BigInt(0)) {
          throw new Error(`${label}: amount must be greater than zero.`);
        }

        if (!milestone.deadline) {
          throw new Error(`${label}: choose a deadline.`);
        }

        const deadlineDate = new Date(milestone.deadline);

        if (Number.isNaN(deadlineDate.getTime())) {
          throw new Error(`${label}: enter a valid deadline.`);
        }

        const deadlineSeconds = Math.floor(deadlineDate.getTime() / 1000);

        if (deadlineSeconds <= nowInSeconds) {
          throw new Error(`${label}: deadline must be in the future.`);
        }

        descriptions.push(description);
        amounts.push(amount);
        deadlines.push(BigInt(deadlineSeconds));
      }

      // The contract is funded with the sum of all milestone amounts.
      const total = amounts.reduce((sum, amount) => sum + amount, BigInt(0));

      setIsSubmitting(true);

      if (!window.ethereum) {
        throw new Error(
          "MetaMask is not installed. Please install it to continue.",
        );
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
          "Your active MetaMask account changed. Refresh the page and try again.",
        );
      }

      if (actualAddress.toLowerCase() === freelancerAddress.toLowerCase()) {
        throw new Error("You cannot assign yourself as the freelancer.");
      }

      const contract = await getEscrowContract();

      const arbitratorAddress = (await contract.arbitrator()) as string;

      if (actualAddress.toLowerCase() === arbitratorAddress.toLowerCase()) {
        throw new Error(
          "The contract arbitrator cannot create a project as the client.",
        );
      }

      if (freelancerAddress.toLowerCase() === arbitratorAddress.toLowerCase()) {
        throw new Error(
          "The contract arbitrator cannot be assigned as the freelancer.",
        );
      }

      const transaction = await contract.createProject(
        freelancerAddress,
        descriptions,
        amounts,
        deadlines,
        { value: total },
      );

      const receipt = await transaction.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error("The project creation transaction failed on-chain.");
      }

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

      setCreatedProject({ id: projectId, hash: transaction.hash });
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---- Success ----
  if (createdProject) {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
              <CheckCircle2 className="size-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Project created
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Your transaction is confirmed on Sepolia. The project budget is
                now locked in the escrow contract.
              </p>
            </div>
          </div>

          {createdProject.id && (
            <div className={`${panel} mt-4 p-4`}>
              <p className="text-xs text-zinc-400">Project ID</p>
              <p className="mt-1 break-all text-xl font-semibold text-white">
                #{createdProject.id}
              </p>
            </div>
          )}

          <a
            href={`https://sepolia.etherscan.io/tx/${createdProject.hash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200"
          >
            View transaction on Etherscan
            <ExternalLink className="size-3.5" />
          </a>

          <div className="mt-5 flex flex-wrap gap-2">
            {createdProject.id && (
              <Link
                href={`/projects/${createdProject.id}`}
                className="inline-flex h-8 items-center rounded-md bg-emerald-400 px-3 text-sm font-medium text-black hover:bg-emerald-300"
              >
                View project
              </Link>
            )}
            <Link
              href="/projects"
              className="inline-flex h-8 items-center rounded-md border border-white/10 px-3 text-sm text-zinc-200 hover:bg-white/5"
            >
              All projects
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreatedProject(null);
                setFreelancer("");
                setMilestones([createMilestone()]);
                setError("");
              }}
              className="border-white/10 text-zinc-200"
            >
              Create another
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // ---- Gate states ----
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
              Connect MetaMask to create and fund an escrow project.
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
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Back to projects
      </Link>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5 sm:space-y-6"
      >
        {/* Freelancer */}
        <section className={`${panel} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
              <Wallet className="size-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Freelancer</h2>
              <p className="text-xs text-zinc-400">
                The wallet that will complete the work.
              </p>
            </div>
          </div>

          <label
            htmlFor="freelancer"
            className="mb-1.5 block text-xs font-medium text-zinc-300"
          >
            Wallet address
          </label>
          <input
            id="freelancer"
            type="text"
            value={freelancer}
            onChange={(event) => setFreelancer(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
            disabled={isSubmitting}
            aria-invalid={!!freelancerHint}
            aria-describedby="freelancer-hint"
            className={`${inputClass} font-mono ${
              freelancerHint ? "border-red-400/40 focus:border-red-400/60" : ""
            }`}
          />
          <p
            id="freelancer-hint"
            className={`mt-1.5 text-xs ${
              freelancerHint ? "text-red-300" : "text-zinc-500"
            }`}
          >
            {freelancerHint ||
              "Double-check this address. Blockchain transactions can't be reversed."}
          </p>
        </section>

        {/* Milestones */}
        <section className={`${panel} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10">
              <FileText className="size-4 text-sky-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Milestones</h2>
              <p className="text-xs text-zinc-400">
                Deliverables with individual budgets.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {milestones.map((milestone, index) => (
              <div
                key={milestone.id}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-medium text-zinc-200">
                    Milestone {index + 1}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeMilestone(milestone.id)}
                    disabled={milestones.length === 1 || isSubmitting}
                    aria-label={`Remove milestone ${index + 1}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={`description-${milestone.id}`}
                      className="mb-1.5 block text-xs text-zinc-400"
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
                          event.target.value,
                        )
                      }
                      placeholder="Describe the work or deliverable..."
                      rows={2}
                      maxLength={500}
                      disabled={isSubmitting}
                      className={`${inputClass} resize-y`}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`amount-${milestone.id}`}
                        className="mb-1.5 block text-xs text-zinc-400"
                      >
                        Budget (ETH)
                      </label>
                      <div className="relative">
                        <Coins className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
                        <input
                          id={`amount-${milestone.id}`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={milestone.amount}
                          onChange={(event) =>
                            updateMilestone(
                              milestone.id,
                              "amount",
                              sanitizeAmount(event.target.value),
                            )
                          }
                          placeholder="0.05"
                          disabled={isSubmitting}
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`deadline-${milestone.id}`}
                        className="mb-1.5 block text-xs text-zinc-400"
                      >
                        Deadline
                      </label>
                      <input
                        id={`deadline-${milestone.id}`}
                        type="datetime-local"
                        value={milestone.deadline}
                        min={toLocalInput(new Date())}
                        onChange={(event) =>
                          updateMilestone(
                            milestone.id,
                            "deadline",
                            event.target.value,
                          )
                        }
                        disabled={isSubmitting}
                        className={`${inputClass} min-w-0 text-zinc-200 [color-scheme:dark]`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addMilestone}
            disabled={milestones.length >= MAX_MILESTONES || isSubmitting}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-white/15 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="size-3.5" />
            Add milestone
          </button>
        </section>

        {error && (
          <section
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
            <p className="break-words text-xs text-red-300">{error}</p>
          </section>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-xs text-zinc-500 sm:mr-auto">
            The total of all milestones is sent to escrow in one transaction.
            You also need Sepolia ETH for gas.
          </p>

          <Link
            href="/projects"
            className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Cancel
          </Link>

          <Button
            type="submit"
            disabled={
              isSubmitting ||
              !isConnected ||
              !isCorrectNetwork ||
              !!freelancerHint
            }
            className="bg-emerald-400 text-black hover:bg-emerald-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Waiting for confirmation...
              </>
            ) : (
              <>
                <Wallet className="size-4" />
                Create and fund project
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
