"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getEscrowContract, CONTRACT_ADDRESS } from "@/lib/contract";
import {
  BrowserProvider,
  isAddress,
  parseEther,
  type TransactionResponse,
  type TransactionReceipt,
} from "ethers";

type MilestoneInput = {
  description: string;
  amount: string;
  deadline: string;
};

type WalletProject = {
  id: string;
  client: string;
  freelancer: string;
  role: "client" | "freelancer" | "arbitrator";
};

type MilestoneDetails = {
  index: number;
  description: string;
  submissionURI: string;
  amountWei: string;
  amountETH: string;
  deadline: string;
  submittedAt: string;
  disputedAt: string;
  revisionCount: number;
  statusCode: number;
  status: string;
};

const SEPOLIA_CHAIN_ID = BigInt(11155111);
const SEPOLIA_HEX = "0xaa36a7";

function errorMessage(error: unknown): string {
  const err = error as {
    code?: number | string;
    shortMessage?: string;
    reason?: string;
    message?: string;
  };

  if (err.code === 4001 || err.code === "ACTION_REJECTED") {
    return "Transaction rejected in MetaMask.";
  }

  if (err.code === 4902) {
    return "Sepolia is not configured in MetaMask.";
  }

  return (
    err.reason || err.shortMessage || err.message || "The operation failed."
  );
}

const MILESTONE_STATUSES = [
  "Funded",
  "Submitted",
  "Disputed",
  "Paid",
  "Refunded",
  "Revision Requested",
  "Split",
] as const;

function getMilestoneStatusLabel(status: unknown): string {
  const index = Number(status);

  return Number.isInteger(index) &&
    index >= 0 &&
    index < MILESTONE_STATUSES.length
    ? MILESTONE_STATUSES[index]
    : "Unknown";
}

function formatDate(timestamp: string): string {
  const seconds = Number(timestamp);

  if (!seconds) return "Not available";

  return new Date(seconds * 1000).toLocaleString();
}

export default function Home() {
  const [account, setAccount] = useState("");
  const [network, setNetwork] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [freelancer, setFreelancer] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { description: "", amount: "", deadline: "" },
  ]);
  const [disputeReason, setDisputeReason] = useState("");
  const [freelancerAward, setFreelancerAward] = useState("");
  const [walletProjects, setWalletProjects] = useState<WalletProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectMilestones, setProjectMilestones] = useState<
    Record<string, MilestoneDetails[]>
  >({});
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});

  const [projectId, setProjectId] = useState("");
  const [milestoneIndex, setMilestoneIndex] = useState("0");
  const [workSubmission, setWorkSubmission] = useState("");
  const [milestoneDetails, setMilestoneDetails] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [withdrawableBalance, setWithdrawableBalance] = useState("0");

  const [lastTransaction, setLastTransaction] = useState<{
    hash: string;
    status: "pending" | "confirmed" | "failed";
    message: string;
  } | null>(null);

  const totalEth = milestones.reduce(
    (total, milestone) => total + (Number(milestone.amount) || 0),
    0,
  );

  const getProvider = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask first.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const networkInfo = await provider.getNetwork();

    if (networkInfo.chainId !== SEPOLIA_CHAIN_ID) {
      throw new Error("Switch MetaMask to Sepolia (Chain ID 11155111).");
    }

    return provider;
  }, []);

  const loadWalletProjects = useCallback(
    async (walletAddress: string) => {
      if (!walletAddress || !isAddress(walletAddress)) {
        setWalletProjects([]);
        setProjectMilestones({});
        setProjectsLoading(false);
        return;
      }

      setProjectsLoading(true);
      setMessage("Connecting to Sepolia and loading your projects...");

      try {
        const provider = await getProvider();
        const contract = await getEscrowContract();

        const [arbitratorAddress, latestBlock] = await Promise.all([
          contract.arbitrator(),
          provider.getBlockNumber(),
        ]);

        const connectedAddress = walletAddress.toLowerCase();
        const arbitrator = String(arbitratorAddress).toLowerCase();

        // Project #6 has known activity around block 11,904,000.
        // Start earlier than that activity to avoid scanning all of Sepolia.
        // Lower this value if your contract has older projects.
        const START_BLOCK = 11_800_000;
        const CHUNK_SIZE = 2_000;

        if (latestBlock < START_BLOCK) {
          throw new Error(
            `Latest block ${latestBlock} is below START_BLOCK ${START_BLOCK}.`,
          );
        }

        const allEvents: Awaited<ReturnType<typeof contract.queryFilter>> = [];

        for (
          let fromBlock = START_BLOCK;
          fromBlock <= latestBlock;
          fromBlock += CHUNK_SIZE
        ) {
          const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock);

          setMessage(
            `Loading project events from Sepolia: blocks ${fromBlock.toLocaleString()}–${toBlock.toLocaleString()} of ${latestBlock.toLocaleString()}...`,
          );

          const events = await contract.queryFilter(
            contract.filters.ProjectCreated(),
            fromBlock,
            toBlock,
          );

          allEvents.push(...events);
        }

        const projectIds = [
          ...new Set(
            allEvents
              .map((event) => {
                if ("args" in event && event.args?.projectId != null) {
                  return event.args.projectId.toString();
                }
                return null;
              })
              .filter((id): id is string => id !== null),
          ),
        ];

        setMessage(
          `Found ${projectIds.length} project creation event(s). Checking wallet access...`,
        );

        const discoveredProjects = await Promise.all(
          projectIds.map(async (id): Promise<WalletProject | null> => {
            const project = await contract.projects(BigInt(id));

            const client = String(project.client ?? project[0]);
            const assignedFreelancer = String(project.freelancer ?? project[1]);

            let role: WalletProject["role"] | null = null;

            if (connectedAddress === arbitrator) {
              role = "arbitrator";
            } else if (connectedAddress === client.toLowerCase()) {
              role = "client";
            } else if (connectedAddress === assignedFreelancer.toLowerCase()) {
              role = "freelancer";
            }

            if (!role) return null;

            return {
              id,
              client,
              freelancer: assignedFreelancer,
              role,
            };
          }),
        );

        const matchingProjects = discoveredProjects
          .filter((project): project is WalletProject => project !== null)
          .sort((a, b) => {
            const idA = BigInt(a.id);
            const idB = BigInt(b.id);
            return idA < idB ? 1 : idA > idB ? -1 : 0;
          });

        setWalletProjects(matchingProjects);

        if (matchingProjects.length === 0) {
          setProjectMilestones({});
          setMessage(
            `No projects were found for ${walletAddress} in the scanned block range ${START_BLOCK.toLocaleString()}–${latestBlock.toLocaleString()}. If older projects exist, lower START_BLOCK in page.tsx.`,
          );
          return;
        }

        setMessage(
          `Found ${matchingProjects.length} project(s). Loading their milestones...`,
        );

        const milestoneEntries = await Promise.all(
          matchingProjects.map(async (project) => {
            const details: MilestoneDetails[] = [];

            for (let index = 0; index < 20; index++) {
              try {
                const result = await contract.getMilestone(
                  BigInt(project.id),
                  BigInt(index),
                );

                const amount = result.amount ?? result[2];

                details.push({
                  index,
                  description: String(result.description ?? result[0]),
                  submissionURI: String(result.submissionURI ?? result[1]),
                  amountWei: amount.toString(),
                  amountETH: (Number(amount) / 1e18).toFixed(6),
                  deadline: (result.deadline ?? result[3]).toString(),
                  submittedAt: (result.submittedAt ?? result[4]).toString(),
                  disputedAt: (result.disputedAt ?? result[5]).toString(),
                  revisionCount: Number(result.revisionCount ?? result[6]),
                  statusCode: Number(result.status ?? result[7]),
                  status: getMilestoneStatusLabel(result.status ?? result[7]),
                });
              } catch {
                // Stop at the first milestone index that does not exist.
                break;
              }
            }

            return [project.id, details] as const;
          }),
        );

        const allMilestones = Object.fromEntries(milestoneEntries);

        if (connectedAddress === arbitrator) {
          const disputedEntries = Object.entries(allMilestones)
            .map(
              ([id, details]) =>
                [
                  id,
                  details.filter((milestone) => milestone.statusCode === 2),
                ] as const,
            )
            .filter(([, details]) => details.length > 0);

          const disputedIds = new Set(disputedEntries.map(([id]) => id));

          const disputedProjects = matchingProjects.filter((project) =>
            disputedIds.has(project.id),
          );

          setWalletProjects(disputedProjects);
          setProjectMilestones(Object.fromEntries(disputedEntries));

          setMessage(
            disputedProjects.length > 0
              ? `Found ${disputedProjects.length} project(s) with disputed milestones.`
              : "No disputed milestones require arbitration right now.",
          );
        } else {
          setWalletProjects(matchingProjects);
          setProjectMilestones(allMilestones);
          setMessage(
            `Loaded ${matchingProjects.length} project(s) and their milestones for ${walletAddress}.`,
          );
        }
        setMessage(
          `Loaded ${matchingProjects.length} project(s) and their milestones for ${walletAddress}.`,
        );
      } catch (error) {
        console.error("Failed to load wallet projects:", error);
        setMessage(
          `Could not load projects: ${errorMessage(error)}. Check the Sepolia RPC connection and START_BLOCK.`,
        );
      } finally {
        setProjectsLoading(false);
      }
    },
    [getProvider],
  );

  const connectWallet = useCallback(async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask first.");
      }

      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const networkInfo = await provider.getNetwork();

      setAccount(address);
      setNetwork(`${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);
      setMessage(`Wallet connected: ${address}. Loading your projects...`);

      const balanceContract = await getEscrowContract();
      const balance = await balanceContract.pendingWithdrawals(address);
      setWithdrawableBalance((Number(balance) / 1e18).toFixed(6));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    if (!account) {
      setWalletProjects([]);
      setProjectMilestones({});
      return;
    }

    void loadWalletProjects(account);
  }, [account, loadWalletProjects]);

  async function switchToSepolia() {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask first.");
      }

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_HEX }],
      });

      await connectWallet();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function testEscrowContract() {
    setLoading(true);

    try {
      const provider = await getProvider();
      const code = await provider.getCode(CONTRACT_ADDRESS);

      if (code === "0x") {
        throw new Error("No contract found at the configured address.");
      }

      setMessage(`Escrow contract detected at ${CONTRACT_ADDRESS}`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function updateMilestone(
    index: number,
    field: keyof MilestoneInput,
    value: string,
  ) {
    setMilestones((current) =>
      current.map((milestone, i) =>
        i === index ? { ...milestone, [field]: value } : milestone,
      ),
    );
  }

  function addMilestone() {
    if (milestones.length >= 20) {
      setMessage("A project can have at most 20 milestones.");
      return;
    }

    setMilestones((current) => [
      ...current,
      { description: "", amount: "", deadline: "" },
    ]);
    setMessage("");
  }

  function removeMilestone(index: number) {
    setMilestones((current) => current.filter((_, i) => i !== index));
    setMessage("");
  }

  async function refreshOnChainData() {
    const projectIsValid = /^\d+$/.test(projectId);
    const milestoneIsValid = /^\d+$/.test(milestoneIndex);

    const provider = await getProvider();
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const contract = await getEscrowContract();

    setAccount(signerAddress);

    const networkInfo = await provider.getNetwork();
    setNetwork(`${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);

    const balance = await contract.pendingWithdrawals(signerAddress);
    setWithdrawableBalance((Number(balance) / 1e18).toFixed(6));

    if (projectIsValid && milestoneIsValid) {
      const result = await contract.getMilestone(
        BigInt(projectId),
        BigInt(milestoneIndex),
      );

      const details = {
        description: result.description ?? result[0],
        submissionURI: result.submissionURI ?? result[1],
        amountWei: (result.amount ?? result[2]).toString(),
        amountETH: (Number(result.amount ?? result[2]) / 1e18).toString(),
        deadline: (result.deadline ?? result[3]).toString(),
        submittedAt: (result.submittedAt ?? result[4]).toString(),
        disputedAt: (result.disputedAt ?? result[5]).toString(),
        revisionCount: Number(result.revisionCount ?? result[6]),
        statusCode: Number(result.status ?? result[7]),
        status: getMilestoneStatusLabel(result.status ?? result[7]),
      };

      setMilestoneDetails(JSON.stringify(details, null, 2));
    }

    await loadWalletProjects(signerAddress);

    return contract;
  }

  async function sendTransaction(
    operation: () => Promise<TransactionResponse>,
    successText: (
      receipt: TransactionReceipt,
      hash: string,
    ) => string | Promise<string>,
  ) {
    if (loading) return;

    setLoading(true);
    let submittedHash = "";
    let minedFailed = false;

    try {
      const tx = await operation();
      submittedHash = tx.hash;

      setLastTransaction({
        hash: tx.hash,
        status: "pending",
        message: "Waiting for blockchain confirmation...",
      });

      setMessage(`Transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error(
          "No transaction receipt yet. Check Etherscan for the latest status.",
        );
      }

      if (receipt.status !== 1) {
        minedFailed = true;

        setLastTransaction({
          hash: tx.hash,
          status: "failed",
          message: "The transaction was mined but reverted.",
        });

        throw new Error("Transaction failed on the blockchain.");
      }

      const result = await successText(receipt, tx.hash);

      setLastTransaction({
        hash: tx.hash,
        status: "confirmed",
        message: `Confirmed in block ${receipt.blockNumber}.`,
      });

      try {
        await refreshOnChainData();
        setMessage(
          `${result}\nProject, milestone and wallet balance refreshed.`,
        );
      } catch (refreshError) {
        setMessage(
          `${result}\nTransaction confirmed, but automatic refresh failed: ${errorMessage(refreshError)}. Use the refresh buttons to reload on-chain data.`,
        );
      }
    } catch (error) {
      console.error("Contract transaction failed:", error);
      setMessage(errorMessage(error));

      const txError = error as {
        receipt?: { status?: number; hash?: string };
        transaction?: { hash?: string };
      };

      const errorReceipt = txError.receipt;
      const failedHash =
        submittedHash || errorReceipt?.hash || txError.transaction?.hash || "";

      if (failedHash && errorReceipt?.status === 0) {
        setLastTransaction({
          hash: failedHash,
          status: "failed",
          message: "The transaction was mined but reverted on-chain.",
        });
      } else if (submittedHash && minedFailed) {
        setLastTransaction({
          hash: submittedHash,
          status: "failed",
          message: "The transaction reverted on-chain.",
        });
      } else if (submittedHash) {
        setLastTransaction({
          hash: submittedHash,
          status: "pending",
          message: "Confirmation could not be verified. Check Etherscan.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    await sendTransaction(
      async () => {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const clientAddress = await signer.getAddress();
        const freelancerAddress = freelancer.trim();

        if (!isAddress(freelancerAddress)) {
          throw new Error("Enter a valid freelancer wallet address.");
        }

        if (freelancerAddress.toLowerCase() === clientAddress.toLowerCase()) {
          throw new Error(
            "The freelancer address must differ from the client.",
          );
        }

        if (milestones.length < 1 || milestones.length > 20) {
          throw new Error("Add between 1 and 20 milestones.");
        }

        const descriptions = milestones.map((milestone) =>
          milestone.description.trim(),
        );

        if (descriptions.some((description) => !description)) {
          throw new Error("Enter a description for every milestone.");
        }

        const amounts = milestones.map((milestone) => {
          if (
            !milestone.amount.trim() ||
            !Number.isFinite(Number(milestone.amount)) ||
            Number(milestone.amount) <= 0
          ) {
            throw new Error("Every milestone must have a positive ETH amount.");
          }

          try {
            return parseEther(milestone.amount.trim());
          } catch {
            throw new Error(
              "Enter a valid ETH amount with at most 18 decimal places.",
            );
          }
        });

        const deadlines = milestones.map((milestone) => {
          if (!milestone.deadline) {
            throw new Error("Set a deadline for every milestone.");
          }

          const deadlineMs = new Date(milestone.deadline).getTime();

          if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
            throw new Error("Every milestone deadline must be in the future.");
          }

          return BigInt(Math.floor(deadlineMs / 1000));
        });

        const totalWei = amounts.reduce(
          (total, amount) => total + amount,
          BigInt(0),
        );

        const contract = await getEscrowContract();
        const arbitrator = String(await contract.arbitrator()).toLowerCase();

        if (arbitrator === freelancerAddress.toLowerCase()) {
          throw new Error("The arbitrator cannot be the freelancer.");
        }

        if (arbitrator === clientAddress.toLowerCase()) {
          throw new Error("The arbitrator cannot be the client.");
        }

        setAccount(clientAddress);
        setNetwork("Sepolia (Chain ID: 11155111)");
        setMessage(
          `Confirm in MetaMask.\nClient: ${clientAddress}\nFreelancer: ${freelancerAddress}\nEscrow: ${CONTRACT_ADDRESS}`,
        );

        const tx = (await contract.createProject(
          freelancerAddress,
          descriptions,
          amounts,
          deadlines,
          { value: totalWei },
        )) as TransactionResponse;

        if (tx.from.toLowerCase() !== clientAddress.toLowerCase()) {
          throw new Error(
            "Transaction sender does not match the connected client.",
          );
        }

        if (!tx.to || tx.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
          throw new Error(
            "Transaction destination does not match the escrow contract.",
          );
        }

        return tx;
      },
      async (receipt, hash) => {
        const contract = await getEscrowContract();
        let newProjectId: string | null = null;

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
            continue;
          }

          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });

            if (parsed?.name === "ProjectCreated") {
              newProjectId = parsed.args.projectId.toString();
              break;
            }
          } catch {
            continue;
          }
        }

        setFreelancer("");
        setMilestones([{ description: "", amount: "", deadline: "" }]);

        if (newProjectId !== null) {
          setProjectId(newProjectId);

          // Immediately reload the project list after creation.
          const signer = await (await getProvider()).getSigner();
          await loadWalletProjects(await signer.getAddress());

          return `Project created and funded successfully!\nProject ID: ${newProjectId}\nTransaction: https://sepolia.etherscan.io/tx/${hash}`;
        }

        return `Transaction confirmed in block ${receipt.blockNumber}, but the ProjectCreated event was not found. https://sepolia.etherscan.io/tx/${hash}`;
      },
    );
  }

  async function loadMilestone() {
    if (loading) return;

    setLoading(true);

    try {
      if (!/^\d+$/.test(projectId) || !/^\d+$/.test(milestoneIndex)) {
        throw new Error(
          "Project ID and milestone index must be non-negative integers.",
        );
      }

      await getProvider();
      const contract = await getEscrowContract();

      const result = await contract.getMilestone(
        BigInt(projectId),
        BigInt(milestoneIndex),
      );

      const details = {
        description: result.description ?? result[0],
        submissionURI: result.submissionURI ?? result[1],
        amountWei: (result.amount ?? result[2]).toString(),
        amountETH: (Number(result.amount ?? result[2]) / 1e18).toString(),
        deadline: (result.deadline ?? result[3]).toString(),
        submittedAt: (result.submittedAt ?? result[4]).toString(),
        disputedAt: (result.disputedAt ?? result[5]).toString(),
        revisionCount: Number(result.revisionCount ?? result[6]),
        statusCode: Number(result.status ?? result[7]),
        status: getMilestoneStatusLabel(result.status ?? result[7]),
      };

      setMilestoneDetails(JSON.stringify(details, null, 2));
      setMessage(
        `Milestone ${milestoneIndex} for project ${projectId}: ${details.status}.`,
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadWithdrawableBalance() {
    if (!account) {
      setMessage("Connect MetaMask before checking your balance.");
      return;
    }

    setLoading(true);

    try {
      await getProvider();
      const contract = await getEscrowContract();
      const balance = await contract.pendingWithdrawals(account);

      setWithdrawableBalance((Number(balance) / 1e18).toFixed(6));
      setMessage("Withdrawable balance loaded from Sepolia.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function withdrawFunds() {
    await sendTransaction(
      async () => {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        const contract = await getEscrowContract();
        const balance = await contract.pendingWithdrawals(signerAddress);

        if (balance === BigInt(0)) {
          throw new Error("Your wallet has no funds available to withdraw.");
        }

        return (await contract.withdraw()) as TransactionResponse;
      },
      (receipt, hash) => {
        setWithdrawableBalance("0.000000");
        return `Withdrawal confirmed in block ${receipt.blockNumber}. https://sepolia.etherscan.io/tx/${hash}`;
      },
    );
  }

  async function submitWork() {
    await sendTransaction(
      async () => {
        await getProvider();

        if (!workSubmission.trim()) {
          throw new Error("Enter a work URL or submission reference.");
        }

        if (!/^\d+$/.test(projectId) || !/^\d+$/.test(milestoneIndex)) {
          throw new Error("Enter valid project and milestone IDs.");
        }

        const contract = await getEscrowContract();
        const fragment = contract.interface.getFunction("submitWork");

        if (!fragment || fragment.inputs.length !== 3) {
          throw new Error("The contract ABI does not match submitWork.");
        }

        return (await contract.submitWork(
          BigInt(projectId),
          BigInt(milestoneIndex),
          workSubmission.trim(),
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Work submission confirmed in block ${receipt.blockNumber}. https://sepolia.etherscan.io/tx/${hash}`,
    );
  }

  async function approveMilestone() {
    await sendTransaction(
      async () => {
        await getProvider();

        if (!/^\d+$/.test(projectId) || !/^\d+$/.test(milestoneIndex)) {
          throw new Error("Enter valid project and milestone IDs.");
        }

        const contract = await getEscrowContract();
        const fragment = contract.interface.getFunction("approveMilestone");

        if (!fragment || fragment.inputs.length !== 2) {
          throw new Error("The contract ABI does not match approveMilestone.");
        }

        return (await contract.approveMilestone(
          BigInt(projectId),
          BigInt(milestoneIndex),
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Milestone approval confirmed in block ${receipt.blockNumber}. https://sepolia.etherscan.io/tx/${hash}`,
    );
  }

  async function requestRevision() {
    await sendTransaction(
      async () => {
        await getProvider();

        if (!/^\d+$/.test(projectId) || !/^\d+$/.test(milestoneIndex)) {
          throw new Error("Enter valid project and milestone IDs.");
        }

        if (!revisionReason.trim()) {
          throw new Error("Enter a reason for requesting a revision.");
        }

        const contract = await getEscrowContract();
        const fragment = contract.interface.getFunction("requestRevision");

        if (!fragment || fragment.inputs.length !== 3) {
          throw new Error("The contract ABI does not match requestRevision.");
        }

        return (await contract.requestRevision(
          BigInt(projectId),
          BigInt(milestoneIndex),
          revisionReason.trim(),
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Revision request confirmed in block ${receipt.blockNumber}. https://sepolia.etherscan.io/tx/${hash}`,
    );
  }

  async function raiseDispute() {
    await sendTransaction(
      async () => {
        await getProvider();

        if (!/^\d+$/.test(projectId) || !/^\d+$/.test(milestoneIndex)) {
          throw new Error("Enter valid project and milestone IDs.");
        }

        const contract = await getEscrowContract();

        const result = await contract.getMilestone(
          BigInt(projectId),
          BigInt(milestoneIndex),
        );

        const status = Number(result.status ?? result[7]);

        if (status !== 1) {
          throw new Error("Only a submitted milestone can be disputed.");
        }

        return (await contract.raiseDispute(
          BigInt(projectId),
          BigInt(milestoneIndex),
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Dispute raised successfully in block ${receipt.blockNumber}. https://sepolia.etherscan.io/tx/${hash}`,
    );
  }

  async function resolveDispute() {
    await sendTransaction(
      async () => {
        await getProvider();

        if (!/^\d+$/.test(projectId) || !/^\d+$/.test(milestoneIndex)) {
          throw new Error("Enter valid project and milestone IDs.");
        }

        if (!freelancerAward.trim()) {
          throw new Error("Enter the freelancer's award in ETH.");
        }

        let awardWei: bigint;

        try {
          awardWei = parseEther(freelancerAward.trim());
        } catch {
          throw new Error("Enter a valid ETH amount.");
        }

        const contract = await getEscrowContract();
        const signer = await (await getProvider()).getSigner();
        const signerAddress = (await signer.getAddress()).toLowerCase();
        const arbitrator = String(await contract.arbitrator()).toLowerCase();

        if (signerAddress !== arbitrator) {
          throw new Error(
            "Connect the designated arbitrator wallet to resolve disputes.",
          );
        }

        const result = await contract.getMilestone(
          BigInt(projectId),
          BigInt(milestoneIndex),
        );

        const amount = BigInt(result.amount ?? result[2]);
        const status = Number(result.status ?? result[7]);

        if (status !== 2) {
          throw new Error("This milestone is not currently disputed.");
        }

        if (awardWei > amount) {
          throw new Error(
            "The freelancer's award cannot exceed the milestone amount.",
          );
        }

        return (await contract.resolveDispute(
          BigInt(projectId),
          BigInt(milestoneIndex),
          awardWei,
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Dispute resolution confirmed in block ${receipt.blockNumber}. https://sepolia.etherscan.io/tx/${hash}`,
    );
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      const nextAccount = accounts[0] || "";
      setAccount(nextAccount);
      setWithdrawableBalance("0");
      setProjectId("");
      setMilestoneDetails("");
      setProjectMilestones({});
      setWalletProjects([]);

      setMessage(
        nextAccount
          ? `Account changed to ${nextAccount}. Loading projects...`
          : "Wallet disconnected.",
      );
    };

    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Veritas</h1>
        <p className="mt-2 text-slate-600">
          Secure milestone-based freelance payments.
        </p>

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Wallet</h2>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={connectWallet}
              className="rounded-lg bg-blue-600 px-5 py-3 text-white"
            >
              {account ? "Reconnect MetaMask" : "Connect MetaMask"}
            </button>

            <button
              onClick={switchToSepolia}
              className="rounded-lg bg-slate-800 px-5 py-3 text-white"
            >
              Switch to Sepolia
            </button>

            <button
              onClick={testEscrowContract}
              disabled={loading}
              className="rounded-lg bg-green-600 px-5 py-3 text-white disabled:opacity-50"
            >
              Test Escrow Contract
            </button>
          </div>

          {account && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="break-all">Connected signer: {account}</p>
              <p>Network: {network}</p>
            </div>
          )}

          <p className="mt-3 break-all text-sm text-slate-600">
            Escrow contract: {CONTRACT_ADDRESS}
          </p>

          {message && (
            <p
              className="mt-4 whitespace-pre-wrap wrap-break-word rounded-lg bg-slate-100 p-3 text-sm"
              aria-live="polite"
            >
              {message}
            </p>
          )}
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Your Projects</h2>
              <p className="mt-2 text-sm text-slate-600">
                Project information is loaded from Sepolia using your connected
                wallet address.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (account) void loadWalletProjects(account);
              }}
              disabled={!account || projectsLoading}
              className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
            >
              {projectsLoading ? "Loading..." : "Refresh Projects"}
            </button>
          </div>

          {!account ? (
            <p className="mt-4 text-sm text-slate-500">
              Connect MetaMask to load your projects.
            </p>
          ) : projectsLoading ? (
            <p className="mt-4 text-sm text-slate-500">
              Reading projects and milestones from Sepolia...
            </p>
          ) : walletProjects.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No associated projects found. You can create a project below or
              enter an existing project ID in Project and Milestone Status.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {walletProjects.map((project) => {
                const details = projectMilestones[project.id] ?? [];
                const expanded = !!expandedProjects[project.id];

                return (
                  <article
                    key={project.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">
                        Project #{project.id}
                      </h3>

                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm capitalize text-blue-700">
                        {project.role}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-sm">
                      <p className="break-all">
                        <strong>Client:</strong> {project.client}
                      </p>
                      <p className="break-all">
                        <strong>Freelancer:</strong> {project.freelancer}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setProjectId(project.id);
                          setMilestoneIndex("0");
                          setExpandedProjects((current) => ({
                            ...current,
                            [project.id]: !current[project.id],
                          }));
                          setMessage(`Selected project ${project.id}.`);
                        }}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-white"
                      >
                        {expanded ? "Hide Milestones" : "View Milestones"}
                      </button>
                    </div>

                    {expanded && (
                      <div className="mt-4 space-y-3">
                        {details.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No milestones could be loaded for this project.
                          </p>
                        ) : (
                          details.map((milestone) => (
                            <div
                              key={milestone.index}
                              className="rounded-lg bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="font-semibold">
                                  Milestone {milestone.index + 1}
                                </h4>
                                <span className="rounded-full bg-white px-3 py-1 text-sm">
                                  {milestone.status}
                                </span>
                              </div>

                              <p className="mt-2 wrap-break-word text-sm">
                                <strong>Description:</strong>{" "}
                                {milestone.description || "No description"}
                              </p>

                              <p className="mt-2 text-sm">
                                <strong>Amount:</strong> {milestone.amountETH}{" "}
                                ETH
                              </p>

                              <p className="mt-2 text-sm">
                                <strong>Deadline:</strong>{" "}
                                {formatDate(milestone.deadline)}
                              </p>

                              <p className="mt-2 text-sm">
                                <strong>Submitted:</strong>{" "}
                                {formatDate(milestone.submittedAt)}
                              </p>

                              <p className="mt-2 text-sm">
                                <strong>Revision count:</strong>{" "}
                                {milestone.revisionCount}
                              </p>

                              {milestone.submissionURI && (
                                <p className="mt-2 break-all text-sm">
                                  <strong>Submission:</strong>{" "}
                                  {milestone.submissionURI}
                                </p>
                              )}

                              {milestone.disputedAt !== "0" && (
                                <p className="mt-2 text-sm">
                                  <strong>Disputed at:</strong>{" "}
                                  {formatDate(milestone.disputedAt)}
                                </p>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setProjectId(project.id);
                                  setMilestoneIndex(String(milestone.index));
                                  setMilestoneDetails(
                                    JSON.stringify(milestone, null, 2),
                                  );
                                  setMessage(
                                    `Selected milestone ${milestone.index} in project ${project.id}.`,
                                  );
                                }}
                                className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              >
                                Select Milestone
                              </button>
                              {project.role !== "arbitrator" &&
                                milestone.statusCode === 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProjectId(project.id);
                                      setMilestoneIndex(
                                        String(milestone.index),
                                      );
                                      setMessage(
                                        `Selected submitted milestone ${milestone.index} in project ${project.id}.`,
                                      );
                                    }}
                                    className="mt-3 ml-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
                                  >
                                    Select for Dispute
                                  </button>
                                )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Wallet Funds</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pending milestone payments credited to the connected wallet.
          </p>

          <p className="mt-4 text-2xl font-semibold">
            {withdrawableBalance} ETH
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={loadWithdrawableBalance}
              disabled={loading || !account}
              className="rounded-lg border border-slate-300 px-5 py-3 disabled:opacity-50"
            >
              Refresh Balance
            </button>

            <button
              onClick={withdrawFunds}
              disabled={loading || !account}
              className="rounded-lg bg-blue-700 px-5 py-3 text-white disabled:opacity-50"
            >
              {loading ? "Processing..." : "Withdraw Funds"}
            </button>
          </div>

          {lastTransaction && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Latest Transaction</h3>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    lastTransaction.status === "confirmed"
                      ? "bg-green-100 text-green-800"
                      : lastTransaction.status === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {lastTransaction.status === "confirmed"
                    ? "Confirmed"
                    : lastTransaction.status === "failed"
                      ? "Failed"
                      : "Pending confirmation"}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-600">
                {lastTransaction.message}
              </p>
              <p className="mt-3 break-all font-mono text-sm">
                {lastTransaction.hash}
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(lastTransaction.hash);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2"
                >
                  Copy hash
                </button>
                <a
                  href={`https://sepolia.etherscan.io/tx/${lastTransaction.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white"
                >
                  View on Etherscan ↗
                </a>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Create Freelance Project</h2>
          <p className="mt-2 text-sm text-slate-600">
            The connected client funds escrow. The freelancer address is
            assigned to the project.
          </p>

          <label className="mt-5 block text-sm font-medium">
            Freelancer wallet address
          </label>
          <input
            value={freelancer}
            onChange={(event) => setFreelancer(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
          />

          <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm">
            <p className="font-medium">Transaction participants</p>
            <p className="mt-2 break-all">
              Client / sender: {account || "Connect MetaMask first"}
            </p>
            <p className="mt-2 break-all">
              Freelancer / recipient:{" "}
              {freelancer.trim() || "Enter freelancer address above"}
            </p>
            <p className="mt-2 break-all">
              Escrow contract: {CONTRACT_ADDRESS}
            </p>
          </div>

          <h3 className="mt-6 font-semibold">Milestones</h3>

          {milestones.map((milestone, index) => (
            <div
              key={index}
              className="mt-4 rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Milestone {index + 1}</h4>
                {milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    className="text-sm text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>

              <label className="mt-3 block text-sm">Description</label>
              <input
                value={milestone.description}
                onChange={(event) =>
                  updateMilestone(index, "description", event.target.value)
                }
                placeholder="Complete homepage design"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />

              <label className="mt-3 block text-sm">Amount (ETH)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={milestone.amount}
                onChange={(event) =>
                  updateMilestone(index, "amount", event.target.value)
                }
                placeholder="0.05"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />

              <label className="mt-3 block text-sm">Deadline</label>
              <input
                type="datetime-local"
                value={milestone.deadline}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                onChange={(event) =>
                  updateMilestone(index, "deadline", event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addMilestone}
            disabled={milestones.length >= 20}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
          >
            + Add Milestone
          </button>

          <div className="mt-5 rounded-lg bg-slate-100 p-4">
            <p className="text-sm text-slate-600">Total amount to deposit</p>
            <p className="mt-1 text-2xl font-bold">{totalEth.toFixed(6)} ETH</p>
          </div>

          <button
            type="button"
            onClick={createProject}
            disabled={loading || !account}
            className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading
              ? "Processing transaction..."
              : "Create Project & Fund Escrow"}
          </button>
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">
            Project and Milestone Status
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Project ID</label>
              <input
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Milestone index
              </label>
              <input
                value={milestoneIndex}
                onChange={(event) => setMilestoneIndex(event.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </div>
          </div>

          <button
            onClick={loadMilestone}
            disabled={loading}
            className="mt-4 rounded-lg bg-slate-800 px-5 py-3 text-white disabled:opacity-50"
          >
            Read On-Chain State
          </button>

          {milestoneDetails && (
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-slate-100 p-4 text-sm">
              {milestoneDetails}
            </pre>
          )}
        </section>

        {account && (
          <section className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">Submit Work</h2>
            <p className="mt-2 text-sm text-slate-600">
              The connected wallet must be the assigned freelancer for the
              selected project. The contract enforces this permission.
            </p>

            <label className="mt-4 block text-sm font-medium">
              Work URL or submission reference
            </label>
            <input
              value={workSubmission}
              onChange={(event) => setWorkSubmission(event.target.value)}
              placeholder="https://... or an IPFS CID"
              className="mt-1 w-full rounded-lg border border-slate-300 p-3"
            />

            <button
              onClick={submitWork}
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-purple-700 px-5 py-3 text-white disabled:opacity-50"
            >
              {loading ? "Processing..." : "Submit Work"}
            </button>
          </section>
        )}

        {account && (
          <section className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">Review Milestone</h2>
            <p className="mt-2 text-sm text-slate-600">
              The connected wallet must be the project's client to approve work
              or request a revision. The contract enforces these permissions.
            </p>

            <label className="mt-4 block text-sm font-medium">
              Reason for requesting revision
            </label>
            <textarea
              value={revisionReason}
              onChange={(event) => setRevisionReason(event.target.value)}
              placeholder="Explain what needs to be corrected..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              rows={3}
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={approveMilestone}
                disabled={loading}
                className="rounded-lg bg-green-600 px-5 py-3 text-white disabled:opacity-50"
              >
                Approve and Release Payment
              </button>

              <button
                onClick={requestRevision}
                disabled={loading}
                className="rounded-lg bg-amber-600 px-5 py-3 text-white disabled:opacity-50"
              >
                Request Revision
              </button>
            </div>
          </section>
        )}

        {account && (
          <section className="mt-8 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">Dispute Resolution</h2>

            <p className="mt-2 text-sm text-slate-600">
              Select a project and milestone above before performing a dispute
              action. The smart contract enforces permissions and deadlines.
            </p>

            <div className="mt-4">
              <p className="text-sm font-medium">Raise a dispute</p>
              <p className="mt-1 text-sm text-slate-500">
                Available to the client or freelancer for an eligible submitted
                milestone.
              </p>

              <button
                type="button"
                onClick={raiseDispute}
                disabled={loading}
                className="mt-3 rounded-lg bg-red-600 px-5 py-3 text-white disabled:opacity-50"
              >
                {loading ? "Processing..." : "Raise Dispute"}
              </button>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="font-medium">Resolve a dispute (arbitrator only)</p>
              <p className="mt-1 text-sm text-slate-500">
                Enter the amount awarded to the freelancer. The remainder is
                allocated to the client.
              </p>

              <label className="mt-4 block text-sm font-medium">
                Freelancer award (ETH)
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={freelancerAward}
                onChange={(event) => setFreelancerAward(event.target.value)}
                placeholder="0.005"
                className="mt-2 w-full rounded-lg border border-slate-300 p-3"
              />

              <button
                type="button"
                onClick={resolveDispute}
                disabled={loading}
                className="mt-3 rounded-lg bg-purple-700 px-5 py-3 text-white disabled:opacity-50"
              >
                {loading ? "Processing..." : "Resolve Dispute"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
