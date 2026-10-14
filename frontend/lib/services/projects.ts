import { Contract, JsonRpcProvider, isAddress } from "ethers";
import { ESCROW_ABI, CONTRACT_ADDRESS } from "@/lib/contract";
import type {
  ProjectMilestone,
  ProjectRole,
  WalletProject,
} from "@/types/project";

const START_BLOCK = Number(
  process.env.NEXT_PUBLIC_ESCROW_START_BLOCK ?? "11800000",
);

const CHUNK_SIZE = 10;
const MAX_MILESTONES = 20;
const MAX_RETRIES = 6;
const REQUEST_DELAY_MS = 200;

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
  const message = error instanceof Error ? error.message : String(error);

  let details = "";

  try {
    details = JSON.stringify(error);
  } catch {
    // Keep the original error message if it cannot be serialized.
  }

  return /429|rate.?limit|compute units per second|throughput|too many requests/i.test(
    `${message} ${details}`,
  );
}

async function queryEventsWithRetry(
  contract: Contract,
  filter: ReturnType<Contract["filters"]["ProjectCreated"]>,
  fromBlock: number,
  toBlock: number,
) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (error) {
      if (!isRateLimitError(error) || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      await wait(delay);
    }
  }

  throw new Error("Unable to retrieve project events after retries.");
}

export async function loadWalletProjects(
  walletAddress: string,
): Promise<LoadedWalletProjects> {
  if (!isAddress(walletAddress)) {
    throw new Error("Please provide a valid wallet address.");
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error("The escrow contract address is not configured.");
  }

  if (!Number.isSafeInteger(START_BLOCK) || START_BLOCK < 0) {
    throw new Error("NEXT_PUBLIC_ESCROW_START_BLOCK is invalid.");
  }

  const provider = getProvider();
  const contract = new Contract(CONTRACT_ADDRESS, ESCROW_ABI, provider);

  const [arbitratorAddress, latestBlock] = await Promise.all([
    contract.arbitrator(),
    provider.getBlockNumber(),
  ]);

  if (START_BLOCK > latestBlock) {
    throw new Error(
      `Configured escrow start block ${START_BLOCK} is newer than the latest block ${latestBlock}.`,
    );
  }

  const connectedAddress = walletAddress.toLowerCase();
  const arbitrator = String(arbitratorAddress).toLowerCase();
  const filter = contract.filters.ProjectCreated();

  const allEvents: Awaited<ReturnType<typeof contract.queryFilter>> = [];

  for (
    let fromBlock = START_BLOCK;
    fromBlock <= latestBlock;
    fromBlock += CHUNK_SIZE
  ) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock);

    try {
      const events = await queryEventsWithRetry(
        contract,
        filter,
        fromBlock,
        toBlock,
      );

      allEvents.push(...events);

      if (toBlock < latestBlock) {
        await wait(REQUEST_DELAY_MS);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown RPC error";

      throw new Error(
        `Could not scan Sepolia blocks ${fromBlock}–${toBlock}. ${
          isRateLimitError(error)
            ? "Alchemy rate-limited the request after multiple retries. Try refreshing later or use an RPC provider with higher throughput."
            : message
        }`,
      );
    }
  }

  const projectIds = [
    ...new Set(
      allEvents.flatMap((event) => {
        if (!("args" in event)) return [];

        const args = event.args as
          | { projectId?: bigint | number | string }
          | undefined;

        return args?.projectId == null ? [] : [String(args.projectId)];
      }),
    ),
  ];

  const discovered = await Promise.all(
    projectIds.map(async (id): Promise<WalletProject | null> => {
      const project = await contract.projects(BigInt(id));

      const client = String(project.client ?? project[0]);
      const freelancer = String(project.freelancer ?? project[1]);

      let role: ProjectRole | null = null;

      if (connectedAddress === arbitrator) {
        role = "arbitrator";
      } else if (connectedAddress === client.toLowerCase()) {
        role = "client";
      } else if (connectedAddress === freelancer.toLowerCase()) {
        role = "freelancer";
      }

      return role ? { id, client, freelancer, role } : null;
    }),
  );

  const projects = discovered
    .filter((project): project is WalletProject => project !== null)
    .sort((a, b) => {
      const left = BigInt(a.id);
      const right = BigInt(b.id);
      return left > right ? -1 : left < right ? 1 : 0;
    });

  const milestoneEntries = await Promise.all(
    projects.map(async (project) => {
      const details: ProjectMilestone[] = [];

      for (let index = 0; index < MAX_MILESTONES; index++) {
        try {
          const result = await contract.getMilestone(
            BigInt(project.id),
            BigInt(index),
          );

          const amount = result.amount ?? result[2];
          const amountWei = amount.toString();
          const statusCode = Number(result.status ?? result[7]);

          details.push({
            index,
            description: String(result.description ?? result[0]),
            submissionURI: String(result.submissionURI ?? result[1]),
            amountWei,
            amountETH: (Number(amountWei) / 1e18).toFixed(6),
            deadline: Number(result.deadline ?? result[3]),
            submittedAt: Number(result.submittedAt ?? result[4]),
            disputedAt: Number(result.disputedAt ?? result[5]),
            revisionCount: Number(result.revisionCount ?? result[6]),
            statusCode,
            status: STATUS_LABELS[statusCode] ?? "Unknown",
          });
        } catch {
          break;
        }
      }

      return [project.id, details] as const;
    }),
  );

  return {
    projects,
    milestones: Object.fromEntries(milestoneEntries),
    latestBlock,
    scannedEvents: allEvents.length,
  };
}
