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

  async function handleSubmitWork(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError(null);

    const trimmedURI = submissionURI.trim();

    let parsedURL: URL;

    try {
      parsedURL = new URL(trimmedURI);
    } catch {
      setError("Please enter a valid URL, including https://");
      return;
    }

    if (!["http:", "https:"].includes(parsedURL.protocol)) {
      setError("Enter a valid HTTP or HTTPS URL.");
      return;
    }

    if (!onSubmitWork) {
      setError("Work submission has not been connected to the contract yet.");
      return;
    }

    setBusy(true);

    try {
      await onSubmitWork(trimmedURI);
      setSubmissionURI("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Submission failed.",
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

      {/* Freelancer: inline work submission form */}
      {role === "freelancer" &&
        ["Funded", "Revision Requested"].includes(milestone.status) && (
          <form onSubmit={handleSubmitWork} className="mt-5 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor={`submission-url-${milestone.index}`}
                className="block text-sm font-medium text-zinc-300"
              >
                Work submission URL
              </label>

              <input
                id={`submission-url-${milestone.index}`}
                type="url"
                value={submissionURI}
                onChange={(event) => {
                  setSubmissionURI(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://github.com/username/project"
                disabled={disabled}
                required
                className="h-11 w-full rounded-lg border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-zinc-600 transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <p className="text-xs text-zinc-500">
                Share a GitHub repository, Google Drive file, or project demo.
              </p>
            </div>

            <button
              type="submit"
              disabled={disabled || !submissionURI.trim() || !onSubmitWork}
              className={buttonClass("blue")}
            >
              <FileUp className="size-4" />
              {busy ? "Submitting..." : "Submit work"}
            </button>
          </form>
        )}

      {/* Client: approve or request revision */}
      {role === "client" && milestone.status === "Submitted" && (
        <div className="mt-5 space-y-4">
          <button
            type="button"
            disabled={disabled || !onApprove}
            className={buttonClass("green")}
            onClick={() => void runAction(onApprove)}
          >
            <CheckCircle2 className="size-4" />
            Approve milestone
          </button>

          <label className="block text-sm text-zinc-300">
            Revision reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Explain what needs to be changed..."
              disabled={disabled}
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

      {/* Client or freelancer: raise a dispute */}
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
              disabled={disabled}
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

      {/* Freelancer: withdraw funds */}
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
