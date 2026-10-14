"use client";

import { useCallback, useEffect, useState } from "react";
import { loadWalletProjects } from "@/lib/services/projects";
import type { ProjectMilestone, WalletProject } from "@/types/project";

type UseProjectsResult = {
  projects: WalletProject[];
  milestones: Record<string, ProjectMilestone[]>;
  isLoading: boolean;
  error: string | null;
  latestBlock: number | null;
  refreshProjects: () => Promise<void>;
};

export function useProjects(
  walletAddress: string | null | undefined,
): UseProjectsResult {
  const [projects, setProjects] = useState<WalletProject[]>([]);
  const [milestones, setMilestones] = useState<
    Record<string, ProjectMilestone[]>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);

  const refreshProjects = useCallback(async () => {
    if (!walletAddress) {
      setProjects([]);
      setMilestones({});
      setLatestBlock(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loadWalletProjects(walletAddress);
      setProjects(result.projects);
      setMilestones(result.milestones);
      setLatestBlock(result.latestBlock);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load escrow projects.",
      );
      setProjects([]);
      setMilestones({});
      setLatestBlock(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  return {
    projects,
    milestones,
    isLoading,
    error,
    latestBlock,
    refreshProjects,
  };
}
