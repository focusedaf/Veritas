import {
  Contract,
  JsonRpcProvider,
  isAddress,
  formatEther,
} from "ethers";

import { ESCROW_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import type {
  ProjectMilestone,
  ProjectRole,
  WalletProject,
} from "@/types/project";

const START_BLOCK = Number(
  process.env.NEXT_PUBLIC_ESCROW_START_BLOCK ?? "11800000",
);

const CHUNK_SIZE = 1000;
const MAX_RETRIES = 6;
const REQUEST_DELAY_MS = 200;
const MAX_MILESTONES = 20;

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

type ProjectCreatedEvent = {
  args?: {
    projectId?: bigint | number | string;
  } | null;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getProvider(): JsonRpcProvider {
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  if (!rpcUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SEPOLIA_RPC_URL in frontend/.env.local.",
    );
  }

  return new JsonRpcProvider(rpcUrl);
}

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error);

  let details = "";

  try {
    details = JSON.stringify(error);
  } catch {
    // Keep the original error message.
  }

  return /429|rate.?limit|compute units per second|throughput|too many requests|timeout|timed out|network error|block range|query returned more than/i.test(
    `${message} ${details}`,
  );
}

async function queryEventsWithRetry(
  contract: Contract,
  fromBlock: number,
  toBlock: number,
) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await contract.queryFilter(
        contract.filters.ProjectCreated(),
        fromBlock,
        toBlock,
      );
    } catch (error) {
      if (!isRateLimitError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = Math.min(1000 * 2 ** attempt, 30000);
      await wait(delay);
    }
  }

  throw new Error("Unable to retrieve project events after retries.");
}

function readField(
  result: unknown,
  name: string,
  index: number,
): unknown {
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

async function loadProjectMetadata(
  contract: Contract,
  id: string,
  walletAddress: string,
  arbitratorAddress: string,
): Promise<ProjectMetadata | null> {
  const result = await contract.projects(BigInt(id));

  const client = String(readField(result, "client", 0));
  const freelancer = String(readField(result, "freelancer", 1));
  const milestoneCount = Number(
    readField(result, "milestoneCount", 4),
  );

  if (!isAddress(client) || !isAddress(freelancer)) {
    throw new Error(
      `Project ${id} returned invalid participant addresses.`,
    );
  }

  if (
    !Number.isSafeInteger(milestoneCount) ||
    milestoneCount < 0 ||
    milestoneCount > MAX_MILESTONES
  ) {
    throw new Error(
      `Project ${id} returned an invalid milestone count: ${milestoneCount}.`,
    );
  }

  const connected = walletAddress.toLowerCase();
  const arbitrator = arbitratorAddress.toLowerCase();

  let role: ProjectRole | null = null;

  if (connected === arbitrator) {
    role = "arbitrator";
  } else if (connected === client.toLowerCase()) {
    role = "client";
  } else if (connected === freelancer.toLowerCase()) {
    role = "freelancer";
  }

  if (!role) return null;

  return {
    id,
    client,
    freelancer,
    role,
    milestoneCount,
  };
}

async function loadProjectMilestones(
  contract: Contract,
  project: ProjectMetadata,
): Promise<[string, ProjectMilestone[]]> {
  const details: ProjectMilestone[] = [];

  for (let index = 0; index < project.milestoneCount; index++) {
    let result: unknown;

    try {
      result = await contract.getMilestone(
        BigInt(project.id),
        BigInt(index),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Could not load milestone ${index + 1} of project ${project.id}: ${message}`,
      );
    }

    const amount = BigInt(
      String(readField(result, "amount", 2)),
    );
    const statusCode = Number(readField(result, "status", 7));

    details.push({
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

  return [project.id, details];
}

export async function loadWalletProjects(
  walletAddress: string,
): Promise<LoadedWalletProjects> {
  if (!isAddress(walletAddress)) {
    throw new Error("Please provide a valid wallet address.");
  }

  if (!CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)) {
    throw new Error(
      "The escrow contract address is missing or invalid.",
    );
  }

  if (!Number.isSafeInteger(START_BLOCK) || START_BLOCK < 0) {
    throw new Error("NEXT_PUBLIC_ESCROW_START_BLOCK is invalid.");
  }

  const provider = getProvider();
  const contract = new Contract(
    CONTRACT_ADDRESS,
    ESCROW_ABI,
    provider,
  );

  let arbitratorAddress: string;
  let latestBlock: number;

  try {
    [arbitratorAddress, latestBlock] = await Promise.all([
      contract.arbitrator() as Promise<string>,
      provider.getBlockNumber(),
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    throw new Error(
      `Unable to connect to the Sepolia RPC: ${message}`,
    );
  }

  if (!isAddress(arbitratorAddress)) {
    throw new Error(
      "The escrow contract returned an invalid arbitrator address.",
    );
  }

  if (START_BLOCK > latestBlock) {
    throw new Error(
      `Configured escrow start block ${START_BLOCK} is newer than the latest block ${latestBlock}. Check NEXT_PUBLIC_ESCROW_START_BLOCK.`,
    );
  }

  const connectedAddress = walletAddress.toLowerCase();
  const arbitrator = arbitratorAddress.toLowerCase();

  const allEvents: ProjectCreatedEvent[] = [];

  for (
    let fromBlock = START_BLOCK;
    fromBlock <= latestBlock;
    fromBlock += CHUNK_SIZE
  ) {
    const toBlock = Math.min(
      fromBlock + CHUNK_SIZE - 1,
      latestBlock,
    );

    try {
      const events = await queryEventsWithRetry(
        contract,
        fromBlock,
        toBlock,
      );

      allEvents.push(...(events as ProjectCreatedEvent[]));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Could not scan Sepolia blocks ${fromBlock}–${toBlock}. ${
          isRateLimitError(error)
            ? "The RPC provider may be limiting requests or rejecting the block range. Try a smaller chunk size or another provider."
            : message
        }`,
      );
    }

    if (toBlock < latestBlock) {
      await wait(REQUEST_DELAY_MS);
    }
  }

  const projectIds = [
    ...new Set(
      allEvents.flatMap((event) => {
        const projectId = event.args?.projectId;

        return projectId == null ? [] : [String(projectId)];
      }),
    ),
  ];

  const metadataResults: ProjectMetadata[] = [];

  // Load projects sequentially to reduce RPC pressure.
  for (const id of projectIds) {
    const project = await loadProjectMetadata(
      contract,
      id,
      connectedAddress,
      arbitrator,
    );

    if (project) {
      metadataResults.push(project);
    }

    await wait(REQUEST_DELAY_MS);
  }

  const projects = metadataResults
    .map(({ milestoneCount: _milestoneCount, ...project }) => project)
    .sort((a, b) => {
      const left = BigInt(a.id);
      const right = BigInt(b.id);

      return left > right ? -1 : left < right ? 1 : 0;
    });

  const metadataById = new Map(
    metadataResults.map((project) => [project.id, project]),
  );

  const milestoneEntries: [string, ProjectMilestone[]][] = [];

  for (const project of projects) {
    const metadata = metadataById.get(project.id);

    if (!metadata) continue;

    const entry = await loadProjectMilestones(contract, metadata);
    milestoneEntries.push(entry);

    await wait(REQUEST_DELAY_MS);
  }

  return {
    projects,
    milestones: Object.fromEntries(milestoneEntries),
    latestBlock,
    scannedEvents: allEvents.length,
  };
}