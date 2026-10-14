"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, RotateCcw, Scale, Wallet } from "lucide-react";
import type { ProjectMilestone } from "@/types/project";

type MilestoneActionsProps = {
  milestone: ProjectMilestone;
  role: "client" | "freelancer" | "arbitrator";
  isLoading?: boolean;
  onSubmitWork?: (submissionURI: string) => Promise<void>;
  onApprove?: () => Promise<void>;
  onRequestRevision?: (reason: string) => Promise<void>;
  onRaiseDispute?: (reason: string) => Promise<void>;
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
      setError(err instanceof Error ? err.message : "The transaction failed.");
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

      {role === "freelancer" && milestone.status !== "Paid" && (
        <div className="mt-5 space-y-3">
          <label className="block text-sm text-zinc-300">
            Work submission URL
            <input
              value={submissionURI}
              onChange={(event) => setSubmissionURI(event.target.value)}
              placeholder="https://..."
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
            />
          </label>

          <button
            type="button"
            disabled={disabled || !submissionURI.trim()}
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

      {role === "client" && milestone.status === "Submitted" && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            className={buttonClass("green")}
            onClick={() => void runAction(onApprove)}
          >
            <CheckCircle2 className="size-4" />
            Approve milestone
          </button>

          <button
            type="button"
            disabled={disabled || !onRequestRevision || !reason.trim()}
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

      {(role === "client" || role === "freelancer") &&
        milestone.status !== "Paid" &&
        milestone.status !== "Refunded" && (
          <div className="mt-5 space-y-3">
            <label className="block text-sm text-zinc-300">
              {milestone.status === "Submitted"
                ? "Revision request reason (optional)"
                : "Dispute reason"}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Explain the issue..."
                className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
              />
            </label>

            <button
              type="button"
              disabled={disabled || !onRaiseDispute || !reason.trim()}
              className={buttonClass("red")}
              onClick={() =>
                void runAction(
                  onRaiseDispute
                    ? () => onRaiseDispute(reason.trim())
                    : undefined,
                )
              }
            >
              <Scale className="size-4" />
              Raise dispute
            </button>
          </div>
        )}

      {role === "arbitrator" && milestone.status === "Disputed" && (
        <div className="mt-5 space-y-3">
          <label className="block text-sm text-zinc-300">
            Freelancer award (ETH)
            <input
              value={freelancerAward}
              onChange={(event) => setFreelancerAward(event.target.value)}
              inputMode="decimal"
              placeholder="0.01"
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
            />
          </label>

          <button
            type="button"
            disabled={disabled || !freelancerAward.trim()}
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

      {role === "freelancer" && milestone.status === "Paid" && (
        <button
          type="button"
          disabled={disabled || !onWithdraw}
          className={`mt-5 ${buttonClass("green")}`}
          onClick={() => void runAction(onWithdraw)}
        >
          <Wallet className="size-4" />
          Withdraw funds
        </button>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {busy && (
        <p className="mt-3 text-xs text-zinc-500">
          Waiting for the action to finish...
        </p>
      )}
    </section>
  );
}
