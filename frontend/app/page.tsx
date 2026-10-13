"use client";

import { getEscrowContract, CONTRACT_ADDRESS } from "@/lib/contract";
import { useCallback, useEffect, useState } from "react";
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

export default function Home() {
  const [account, setAccount] = useState("");
  const [network, setNetwork] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletRole, setWalletRole] = useState<
    "client" | "freelancer" | "arbitrator" | "unknown"
  >("unknown");
  const [freelancer, setFreelancer] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { description: "", amount: "", deadline: "" },
  ]);
  
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

  async function detectWalletRole() {
    if (!account) {
      setWalletRole("unknown");
      setMessage("Connect MetaMask first.");
      return;
    }

    if (!/^\d+$/.test(projectId)) {
      setWalletRole("unknown");
      setMessage("Enter a valid project ID first.");
      return;
    }

    setLoading(true);

    try {
      await getProvider();

      const contract = await getEscrowContract();
      const [project, arbitrator] = await Promise.all([
        contract.projects(BigInt(projectId)),
        contract.arbitrator(),
      ]);

      const client = String(project.client ?? project[0]);
      const freelancerAddress = String(project.freelancer ?? project[1]);

      let role: "client" | "freelancer" | "arbitrator" | "unknown" = "unknown";

      if (account.toLowerCase() === client.toLowerCase()) {
        role = "client";
      } else if (account.toLowerCase() === freelancerAddress.toLowerCase()) {
        role = "freelancer";
      } else if (account.toLowerCase() === String(arbitrator).toLowerCase()) {
        role = "arbitrator";
      }

      setWalletRole(role);
      setMessage(`Connected wallet role for project ${projectId}: ${role}.`);
    } catch (error) {
      setWalletRole("unknown");
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

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
      setMessage(`Connected wallet: ${address}`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }, []);

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

      console.log("Transaction hash:", tx.hash);
      console.log("Transaction sender:", tx.from);
      console.log("Transaction destination:", tx.to);

      setMessage(`Transaction submitted: ${tx.hash}`);
      setLastTransaction({
        hash: tx.hash,
        status: "pending",
        message: "Waiting for blockchain confirmation...",
      });

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

      setMessage(result);
      setLastTransaction({
        hash: tx.hash,
        status: "confirmed",
        message: `Confirmed in block ${receipt.blockNumber}.`,
      });
    } catch (error) {
      console.error("Contract transaction failed:", error);
      setMessage(errorMessage(error));

      if (submittedHash && !minedFailed) {
        setLastTransaction({
          hash: submittedHash,
          status: "pending",
          message:
            "Confirmation could not be verified. Open Etherscan to check the transaction status.",
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

        setAccount(clientAddress);
        setNetwork("Sepolia (Chain ID: 11155111)");

        const freelancerAddress = freelancer.trim();

        console.log("========== PROJECT CREATION DEBUG ==========");
        console.log("Connected client wallet:", clientAddress);
        console.log("Freelancer input value:", freelancerAddress);
        console.log("Configured escrow contract:", CONTRACT_ADDRESS);
        console.log("=============================================");

        if (!isAddress(freelancerAddress)) {
          throw new Error("Enter a valid freelancer wallet address.");
        }

        if (freelancerAddress.toLowerCase() === clientAddress.toLowerCase()) {
          throw new Error(
            "The freelancer address must differ from the connected client wallet.",
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
        const arbitrator = String(await contract.arbitrator());

        if (arbitrator.toLowerCase() === freelancerAddress.toLowerCase()) {
          throw new Error(
            "The arbitrator cannot be the freelancer. Enter the intended freelancer wallet address.",
          );
        }

        if (arbitrator.toLowerCase() === clientAddress.toLowerCase()) {
          throw new Error(
            "The arbitrator cannot be the client. Connect a different client wallet.",
          );
        }

        console.log("Final createProject arguments:", {
          freelancer: freelancerAddress,
          descriptions,
          amountsWei: amounts.map(String),
          deadlines: deadlines.map(String),
          valueWei: totalWei.toString(),
          transactionFrom: clientAddress,
          transactionTo: CONTRACT_ADDRESS,
        });

        setMessage(
          `Check MetaMask before confirming.\nClient/sender: ${clientAddress}\nFreelancer/recipient: ${freelancerAddress}\nEscrow contract: ${CONTRACT_ADDRESS}`,
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
            `Unexpected transaction sender. Expected ${clientAddress}, received ${tx.from}.`,
          );
        }

        if (!tx.to || tx.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
          throw new Error(
            `Unexpected transaction destination. Expected ${CONTRACT_ADDRESS}, received ${tx.to ?? "none"}.`,
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

          return `Project created and funded successfully!\nProject ID: ${newProjectId}\nTransaction: ${hash}\nView: https://sepolia.etherscan.io/tx/${hash}`;
        }

        return `Transaction confirmed in block ${receipt.blockNumber}, but the ProjectCreated event was not found in the receipt. Check the transaction on Etherscan: https://sepolia.etherscan.io/tx/${hash}`;
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

      setMilestoneDetails(
        JSON.stringify(
          result,
          (_, value) => (typeof value === "bigint" ? value.toString() : value),
          2,
        ),
      );

      setMessage("Milestone data loaded from Sepolia.");
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
        await getProvider();

        const contract = await getEscrowContract();
        const balance = await contract.pendingWithdrawals(account);

        if (balance === BigInt(0)) {
          throw new Error("Your wallet has no funds available to withdraw.");
        }

        return (await contract.withdraw()) as TransactionResponse;
      },
      (receipt, hash) => {
        setWithdrawableBalance("0.000000");

        return `Withdrawal confirmed in block ${receipt.blockNumber}. Transaction: https://sepolia.etherscan.io/tx/${hash}`;
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

        if (!fragment) {
          throw new Error("submitWork is missing from the contract ABI.");
        }

        if (fragment.inputs.length !== 3) {
          throw new Error(
            `The ABI defines submitWork with ${fragment.inputs.length} arguments. Check the call against Escrow.sol.`,
          );
        }

        return (await contract.submitWork(
          BigInt(projectId),
          BigInt(milestoneIndex),
          workSubmission.trim(),
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Work submission confirmed in block ${receipt.blockNumber}. Transaction: ${hash}`,
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

        if (!fragment) {
          throw new Error("approveMilestone is missing from the contract ABI.");
        }

        if (fragment.inputs.length !== 2) {
          throw new Error(
            `The ABI defines approveMilestone with ${fragment.inputs.length} arguments. Check the call against Escrow.sol.`,
          );
        }

        return (await contract.approveMilestone(
          BigInt(projectId),
          BigInt(milestoneIndex),
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Milestone approval confirmed in block ${receipt.blockNumber}. Transaction: ${hash}`,
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

        if (!fragment) {
          throw new Error("requestRevision is missing from the contract ABI.");
        }

        if (fragment.inputs.length !== 3) {
          throw new Error(
            `Expected 3 requestRevision arguments, but the ABI defines ${fragment.inputs.length}.`,
          );
        }

        return (await contract.requestRevision(
          BigInt(projectId),
          BigInt(milestoneIndex),
          revisionReason.trim(),
        )) as TransactionResponse;
      },
      (receipt, hash) =>
        `Revision request confirmed in block ${receipt.blockNumber}. Transaction: ${hash}`,
    );
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setAccount(accounts[0] || "");
      setMessage(
        accounts.length
          ? `MetaMask account changed to ${accounts[0]}. Verify the role before transacting.`
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
            
            <button
              type="button"
              onClick={detectWalletRole}
              disabled={loading || !account || !projectId.trim()}
              className="mt-4 ml-3 rounded-lg bg-indigo-600 px-5 py-3 text-white disabled:opacity-50"
            >
              Detect My Role
            </button>
          </div>

          {account && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="wrap-break-word">Connected signer: {account}</p>
              <p>Network: {network}</p>
            </div>
          )}

          <p className="mt-3 wrap-break-word text-sm text-slate-600">
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
          <h2 className="text-xl font-semibold">Wallet Funds</h2>

          <p className="mt-2 text-sm text-slate-600">
            Pending milestone payments and refunds credited to your connected
            wallet.
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
            <section className="mt-4 rounded-lg border border-slate-200 p-4">
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
                  onClick={() =>
                    void navigator.clipboard.writeText(lastTransaction.hash)
                  }
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
            </section>
          )}
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Create Freelance Project</h2>
          <p className="mt-2 text-sm text-slate-600">
            The connected client wallet funds the project. The address below is
            the freelancer who will be assigned to the project.
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
            <p className="mt-2 wrap-break-word">
              Client / transaction sender: {account || "Connect MetaMask first"}
            </p>
            <p className="mt-2 wrap-break-word">
              Freelancer / project recipient:{" "}
              {freelancer.trim() || "Enter freelancer address above"}
            </p>
            <p className="mt-2 wrap-break-word">
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
            disabled={loading}
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

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Freelancer: Submit Work</h2>
          <p className="mt-2 text-sm text-slate-600">
            Connect the freelancer's MetaMask account before submitting work.
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

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Client: Review Milestone</h2>
          <p className="mt-2 text-sm text-slate-600">
            Connect the client MetaMask account before reviewing.
          </p>
          <label className="mt-4 block text-sm font-medium text-slate-700">
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
      </div>
    </main>
  );
}
