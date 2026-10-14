"use client";

import { useState } from "react";
import {
  CheckCircle2,
  FileUp,
  RotateCcw,
  Scale,
  Wallet,
} from "lucide-react";
import type { ProjectMilestone } from "@/types/project";

type MilestoneActionsProps = {
  milestone: ProjectMilestone;
  role: "client" | "freelancer" | "arbitrator";
  isLoading?: boolean;
  onSubmitWork?: (submissionURI: string) => Promise<void>;
  onApprove?: () => Promise<void>;
  onRequestRevision?: (reason: string) => Promise<void>;
  onRaiseDispute?: () => Promise<void>;
  onWithdraw?: () => Promise<void>;
  onResolveDispute?: (freelancerAward: string) => Promise<void>;
};

export function MilestoneActions({
  milestone,
  role,
  isLoading = false,
  onSubmitWork,
  onApprove,
  onRequestRevision,
  onRaiseDispute,
  onWithdraw,
  onResolveDispute,
}: MilestoneActionsProps) {
  const [submissionURI, setSubmissionURI] = useState("");
  const [reason, setReason] = useState("");
  const [freelancerAward, setFreelancerAward] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = isLoading || busy;

  const isTerminal = ["Paid", "Refunded", "Split"].includes(
    milestone.status,
  );

  async function runAction(action?: () => Promise<void>) {
    if (!action) {
      setError("This action has not been connected to the contract yet.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The transaction failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function buttonClass(color: "green" | "blue" | "amber" | "red") {
    const styles = {
      green: "bg-emerald-400 text-black hover:bg-emerald-300",
      blue: "bg-blue-400 text-black hover:bg-blue-300",
      amber: "bg-amber-400 text-black hover:bg-amber-300",
      red: "bg-red-400 text-white hover:bg-red-300 hover:text-black",
    };

    return `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[color]}`;
  }

  return (
    <section className="rounded-2xl border border-white/8 bg-[#111113] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Milestone actions</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Milestone {milestone.index + 1} · {milestone.status}
          </p>
        </div>

        <span className="text-sm font-medium text-zinc-300">
          {milestone.amountETH} ETH
        </span>
      </div>

      {/* Freelancer: submit work for an eligible milestone */}
      {role === "freelancer" &&
        ["Funded", "Revision Requested"].includes(milestone.status) && (
          <div className="mt-5 space-y-3">
            <label className="block text-sm text-zinc-300">
              Work submission URL
              <input
                type="url"
                value={submissionURI}
                onChange={(event) => setSubmissionURI(event.target.value)}
                placeholder="https://..."
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
              />
            </label>

            <button
              type="button"
              disabled={disabled || !submissionURI.trim() || !onSubmitWork}
              className={buttonClass("blue")}
              onClick={() =>
                void runAction(
                  onSubmitWork
                    ? () => onSubmitWork(submissionURI.trim())
                    : undefined,
                )
              }
            >
              <FileUp className="size-4" />
              Submit work
            </button>
          </div>
        )}

      {/* Client: approve or request a revision */}
      {role === "client" && milestone.status === "Submitted" && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || !onApprove}
              className={buttonClass("green")}
              onClick={() => void runAction(onApprove)}
            >
              <CheckCircle2 className="size-4" />
              Approve milestone
            </button>
          </div>

          <label className="block text-sm text-zinc-300">
            Revision reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Explain what needs to be changed..."
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
            />
          </label>

          <button
            type="button"
            disabled={disabled || !reason.trim() || !onRequestRevision}
            className={buttonClass("amber")}
            onClick={() =>
              void runAction(
                onRequestRevision
                  ? () => onRequestRevision(reason.trim())
                  : undefined,
              )
            }
          >
            <RotateCcw className="size-4" />
            Request revision
          </button>
        </div>
      )}

      {/* Client or freelancer: disputes are only valid for submitted work */}
      {(role === "client" || role === "freelancer") &&
        milestone.status === "Submitted" && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-zinc-400">
              Raise a dispute if the submitted work cannot be resolved
              through review. The contract records the dispute on-chain;
              it does not accept a reason argument.
            </p>

            <button
              type="button"
              disabled={disabled || !onRaiseDispute}
              className={buttonClass("red")}
              onClick={() => void runAction(onRaiseDispute)}
            >
              <Scale className="size-4" />
              Raise dispute
            </button>
          </div>
        )}

      {/* Arbitrator: resolve a disputed milestone */}
      {role === "arbitrator" && milestone.status === "Disputed" && (
        <div className="mt-5 space-y-3">
          <label className="block text-sm text-zinc-300">
            Freelancer award (ETH)
            <input
              type="number"
              min="0"
              step="any"
              value={freelancerAward}
              onChange={(event) => setFreelancerAward(event.target.value)}
              placeholder="0.01"
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
            />
          </label>

          <p className="text-xs text-zinc-500">
            The award cannot exceed the milestone amount. The contract
            validates the final amount.
          </p>

          <button
            type="button"
            disabled={
              disabled ||
              !freelancerAward.trim() ||
              !Number.isFinite(Number(freelancerAward)) ||
              Number(freelancerAward) < 0 ||
              !onResolveDispute
            }
            className={buttonClass("amber")}
            onClick={() =>
              void runAction(
                onResolveDispute
                  ? () => onResolveDispute(freelancerAward.trim())
                  : undefined,
              )
            }
          >
            <Scale className="size-4" />
            Resolve dispute
          </button>
        </div>
      )}

      {/* Withdrawals belong to the wallet, not to an individual milestone. */}
      {role === "freelancer" &&
        milestone.status === "Paid" &&
        onWithdraw && (
          <div className="mt-5">
            <button
              type="button"
              disabled={disabled}
              className={buttonClass("green")}
              onClick={() => void runAction(onWithdraw)}
            >
              <Wallet className="size-4" />
              Withdraw funds
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              Withdrawal uses your wallet&apos;s accumulated withdrawable
              balance.
            </p>
          </div>
        )}

      {isTerminal && (
        <p className="mt-5 text-sm text-zinc-500">
          This milestone has reached a final status. No further milestone
          actions are available.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {busy && (
        <p className="mt-3 text-xs text-zinc-500">
          Waiting for the transaction to finish...
        </p>
      )}
    </section>
  );
}