import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  formatEther,
  isAddress,
} from "ethers";
import { ESCROW_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import type {
  ProjectMilestone,
  ProjectRole,
  WalletProject,
} from "@/types/project";

const MAX_MILESTONES = 20;
const MAX_CONCURRENT_PROJECTS = 3;

const STATUS_LABELS: Record<number, ProjectMilestone["status"]> = {
  0: "Funded",
  1: "Submitted",
  2: "Disputed",
  3: "Paid",
  4: "Refunded",
  5: "Revision Requested",
  6: "Split",
};

export type LoadedWalletProjects = {
  projects: WalletProject[];
  milestones: Record<string, ProjectMilestone[]>;
  latestBlock: number;
  scannedEvents: number;
};

type ProjectMetadata = WalletProject & {
  milestoneCount: number;
};

function getProvider(): BrowserProvider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Please install MetaMask and connect your wallet.");
  }
  return new BrowserProvider(window.ethereum);
}

function readField(result: unknown, name: string, index: number): unknown {
  if (result === null || typeof result !== "object") {
    throw new Error(`Invalid contract result while reading ${name}.`);
  }
  const values = result as Record<string | number, unknown>;
  const value = values[name] ?? values[index];
  if (value === undefined || value === null) {
    throw new Error(`Missing contract field: ${name}.`);
  }
  return value;
}

function getRole(
  walletAddress: string,
  client: string,
  freelancer: string,
  arbitrator: string,
): ProjectRole | null {
  const wallet = walletAddress.toLowerCase();
  if (wallet === arbitrator.toLowerCase()) return "arbitrator";
  if (wallet === client.toLowerCase()) return "client";
  if (wallet === freelancer.toLowerCase()) return "freelancer";
  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function loadProjectMetadata(
  contract: Contract,
  id: string,
  walletAddress: string,
  arbitratorAddress: string,
): Promise<ProjectMetadata | null> {
  try {
    const result = await contract.projects(BigInt(id));

    const client = String(readField(result, "client", 0));
    const freelancer = String(readField(result, "freelancer", 1));
    const milestoneCount = Number(readField(result, "milestoneCount", 4));


    if (
      client === ZeroAddress ||
      !isAddress(client) ||
      !isAddress(freelancer)
    ) {
      return null;
    }

    if (
      !Number.isSafeInteger(milestoneCount) ||
      milestoneCount < 0 ||
      milestoneCount > MAX_MILESTONES
    ) {
      return null;
    }

    const role = getRole(walletAddress, client, freelancer, arbitratorAddress);
    if (!role) return null;

    return { id, client, freelancer, role, milestoneCount };
  } catch (error) {
    console.warn(`Skipping project ${id}:`, error);
    return null;
  }
}

async function loadProjectMilestones(
  contract: Contract,
  project: ProjectMetadata,
): Promise<[string, ProjectMilestone[]]> {
  const milestones: ProjectMilestone[] = [];

  for (let index = 0; index < project.milestoneCount; index++) {
    const result = await contract.getMilestone(
      BigInt(project.id),
      BigInt(index),
    );

    const amount = BigInt(String(readField(result, "amount", 2)));
    const statusCode = Number(readField(result, "status", 7));

    milestones.push({
      index,
      description: String(readField(result, "description", 0)),
      submissionURI: String(readField(result, "submissionURI", 1)),
      amountWei: amount.toString(),
      amountETH: formatEther(amount),
      deadline: Number(readField(result, "deadline", 3)),
      submittedAt: Number(readField(result, "submittedAt", 4)),
      disputedAt: Number(readField(result, "disputedAt", 5)),
      revisionCount: Number(readField(result, "revisionCount", 6)),
      statusCode,
      status: STATUS_LABELS[statusCode] ?? "Unknown",
    });
  }

  return [project.id, milestones];
}

export async function loadWalletProjects(
  walletAddress: string,
): Promise<LoadedWalletProjects> {
  if (!isAddress(walletAddress)) {
    throw new Error("Please provide a valid wallet address.");
  }

  if (!CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)) {
    throw new Error("The escrow contract address is missing or invalid.");
  }

  const provider = getProvider();
  const network = await provider.getNetwork();

  if (network.chainId !== BigInt("11155111")) {
    throw new Error("Please switch MetaMask to the Sepolia test network.");
  }

  const contract = new Contract(CONTRACT_ADDRESS, ESCROW_ABI, provider);

  let arbitratorAddress: string;
  let nextId: number;
  let latestBlock: number;

  try {
    const [arb, next, block] = await Promise.all([
      contract.arbitrator() as Promise<string>,
      contract.nextProjectId() as Promise<bigint>,
      provider.getBlockNumber(),
    ]);
    arbitratorAddress = arb;
    nextId = Number(next);
    latestBlock = block;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read the escrow contract: ${message}`);
  }

  // No log scan: just walk the IDs. ID 0 is skipped automatically if unused.
  const projectIds = Array.from({ length: nextId }, (_, i) => String(i));

  const metadata = await mapWithConcurrency(
    projectIds,
    MAX_CONCURRENT_PROJECTS,
    (id) => loadProjectMetadata(contract, id, walletAddress, arbitratorAddress),
  );

  const visibleProjects = metadata
    .filter((project): project is ProjectMetadata => project !== null)
    .sort((a, b) => {
      const l = BigInt(a.id);
      const r = BigInt(b.id);
      return l > r ? -1 : l < r ? 1 : 0;
    });

  const milestoneEntries = await mapWithConcurrency(
    visibleProjects,
    MAX_CONCURRENT_PROJECTS,
    (project) => loadProjectMilestones(contract, project),
  );

  return {
    projects: visibleProjects.map(
      ({ milestoneCount: _milestoneCount, ...project }) => project,
    ),
    milestones: Object.fromEntries(milestoneEntries),
    latestBlock,
    scannedEvents: projectIds.length,
  };
}
