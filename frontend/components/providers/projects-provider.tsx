"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { formatEther } from "ethers";

import { getEscrowContract } from "@/lib/contract";
import { useWallet } from "@/hooks/use-wallet";
import { ProjectsContext, useProjectsLoader } from "@/hooks/use-projects";

function readError(error: unknown): string {
  const err = error as { code?: number | string; shortMessage?: string };

  if (err?.code === 4001 || err?.code === "ACTION_REJECTED") {
    return "Transaction rejected in MetaMask.";
  }

  if (typeof err?.shortMessage === "string") return err.shortMessage;
  if (error instanceof Error) return error.message.slice(0, 200);

  return "Something went wrong.";
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { address, isCorrectNetwork } = useWallet();
  const loader = useProjectsLoader(address);
  const { refreshProjects } = loader;

  const [withdrawable, setWithdrawable] = useState("0");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!address || !isCorrectNetwork) {
      setWithdrawable("0");
      return;
    }

    try {
      const contract = await getEscrowContract();
      const raw = await contract.pendingWithdrawals(address);
      setWithdrawable(formatEther(raw));
    } catch {
      // Balance is a nice-to-have; don't surface read failures.
    }
  }, [address, isCorrectNetwork]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const refreshAll = useCallback(async () => {
    setActionError(null);
    await Promise.all([refreshProjects(), refreshBalance()]);
  }, [refreshProjects, refreshBalance]);

  const withdraw = useCallback(async () => {
    setActionError(null);
    setIsWithdrawing(true);

    try {
      const contract = await getEscrowContract();
      const tx = await contract.withdraw();
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error("Withdrawal failed on-chain.");
      }

      await refreshBalance();
    } catch (error) {
      setActionError(readError(error));
    } finally {
      setIsWithdrawing(false);
    }
  }, [refreshBalance]);

  const value = useMemo(
    () => ({
      ...loader,
      withdrawable,
      isWithdrawing,
      actionError,
      withdraw,
      refreshAll,
    }),
    [loader, withdrawable, isWithdrawing, actionError, withdraw, refreshAll],
  );

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}
