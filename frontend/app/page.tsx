"use client";

import { getEscrowContract, CONTRACT_ADDRESS } from "@/lib/contract";
import { useEffect, useState } from "react";
import { BrowserProvider, isAddress, parseEther } from "ethers";

type MilestoneInput = {
  description: string;
  amount: string;
  deadline: string;
};

export default function Home() {
  const [account, setAccount] = useState("");
  const [message, setMessage] = useState("");
  const [network, setNetwork] = useState("");
  const [loading, setLoading] = useState(false);

  const [freelancer, setFreelancer] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { description: "", amount: "", deadline: "" },
  ]);

  const totalEth = milestones.reduce(
    (total, milestone) => total + (Number(milestone.amount) || 0),
    0,
  );

  async function getProvider() {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask first.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const networkInfo = await provider.getNetwork();

    if (Number(networkInfo.chainId) !== 31337) {
      throw new Error(
        "Please switch MetaMask to Hardhat Local (Chain ID 31337).",
      );
    }

    return provider;
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask first.");
      }

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const networkInfo = await provider.getNetwork();

      setAccount(accounts[0] || "");
      setNetwork(`${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);
      setMessage("Wallet connected successfully!");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Wallet connection failed.",
      );
    }
  }

  async function switchToHardhat() {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask first.");
      }

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }],
      });

      const provider = new BrowserProvider(window.ethereum);
      const networkInfo = await provider.getNetwork();

      setNetwork(`${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);
      setMessage("Switched to Hardhat Local!");
    } catch (error) {
      console.error(error);
      setMessage(
        "Network switch failed. Check that Hardhat Local is added in MetaMask.",
      );
    }
  }

  async function testEscrowContract() {
    try {
      setMessage("Checking escrow contract...");

      const provider = await getProvider();
      const code = await provider.getCode(CONTRACT_ADDRESS);

      if (code === "0x") {
        throw new Error(
          "No contract found. Check the address and redeploy if needed.",
        );
      }

      const contract = await getEscrowContract();

      setMessage(
        `Success! Escrow contract detected at ${await contract.getAddress()}`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "Contract test failed.",
      );
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

  async function createProject() {
    if (loading) return;

    setLoading(true);

    try {
      if (!account) {
        throw new Error("Connect your MetaMask wallet first.");
      }

      if (!isAddress(freelancer)) {
        throw new Error("Enter a valid freelancer wallet address.");
      }

      if (freelancer.toLowerCase() === account.toLowerCase()) {
        throw new Error("You cannot hire your own wallet.");
      }

      if (milestones.length === 0 || milestones.length > 20) {
        throw new Error("Add between 1 and 20 milestones.");
      }

      const descriptions = milestones.map((m) => m.description.trim());

      if (descriptions.some((description) => !description)) {
        throw new Error("Enter a description for every milestone.");
      }

      const amounts = milestones.map((m) => {
        if (
          !m.amount.trim() ||
          !Number.isFinite(Number(m.amount)) ||
          Number(m.amount) <= 0
        ) {
          throw new Error("Every milestone must have a positive ETH amount.");
        }

        try {
          const amount = parseEther(m.amount);

          if (amount <= BigInt(0)) {
            throw new Error("Amount must be positive.");
          }

          return amount;
        } catch {
          throw new Error(
            "Enter valid ETH amounts with at most 18 decimal places.",
          );
        }
      });

      const deadlines = milestones.map((milestone) => {
        if (!milestone.deadline) {
          throw new Error("Please set a deadline for every milestone.");
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

      await getProvider();

      setMessage(
        "Please confirm the project creation and ETH funding in MetaMask...",
      );

      const contract = await getEscrowContract();

      const tx = await contract.createProject(
        freelancer,
        descriptions,
        amounts,
        deadlines,
        { value: totalWei },
      );

      setMessage(`Transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error("The project transaction failed.");
      }

      let projectId = "";

      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);

          if (parsed?.name === "ProjectCreated") {
            projectId = parsed.args.projectId.toString();
            break;
          }
        } catch {
          // Ignore logs emitted by other contracts.
        }
      }

      setMessage(
        `Project created and funded successfully!${
          projectId ? ` Project ID: ${projectId}.` : ""
        } Transaction: ${tx.hash}`,
      );

      setFreelancer("");
      setMilestones([{ description: "", amount: "", deadline: "" }]);
    } catch (error: unknown) {
      console.error("Project creation failed:", error);

      const err = error as {
        code?: number | string;
        shortMessage?: string;
        reason?: string;
        message?: string;
      };

      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        setMessage("Transaction rejected in MetaMask.");
      } else {
        setMessage(
          err.shortMessage ||
            err.reason ||
            err.message ||
            "Could not create the project.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setAccount(accounts[0] || "");
      setMessage(
        accounts.length ? "Wallet account changed." : "Wallet disconnected.",
      );
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
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
              {account ? "Wallet Connected" : "Connect MetaMask"}
            </button>

            <button
              onClick={switchToHardhat}
              className="rounded-lg bg-slate-800 px-5 py-3 text-white"
            >
              Switch to Hardhat Local
            </button>

            <button
              onClick={testEscrowContract}
              className="rounded-lg bg-green-600 px-5 py-3 text-white"
            >
              Test Escrow Contract
            </button>
          </div>

          {account && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="break-all">Address: {account}</p>
              <p>Network: {network}</p>
            </div>
          )}

          {message && (
            <p className="mt-3 wrap-break-word text-sm" aria-live="polite">
              {message}
            </p>
          )}
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Create Freelance Project</h2>

          <p className="mt-2 text-sm text-slate-600">
            The client deposits the full milestone budget when creating the
            project.
          </p>

          <label className="mt-5 block text-sm font-medium">
            Freelancer wallet address
          </label>
          <input
            value={freelancer}
            onChange={(e) => setFreelancer(e.target.value)}
            placeholder="0x..."
            className="mt-2 w-full rounded-lg border border-slate-300 p-3"
          />

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
                onChange={(e) =>
                  updateMilestone(index, "description", e.target.value)
                }
                placeholder="e.g. Complete homepage design"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />

              <label className="mt-3 block text-sm">Amount (ETH)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={milestone.amount}
                onChange={(e) =>
                  updateMilestone(index, "amount", e.target.value)
                }
                placeholder="e.g. 0.05"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />

              <label className="mt-3 block text-sm">Deadline</label>
              <input
                type="datetime-local"
                value={milestone.deadline}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                onChange={(e) =>
                  updateMilestone(index, "deadline", e.target.value)
                }
                required
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
            className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Processing transaction..."
              : "Create Project & Fund Escrow"}
          </button>
        </section>
      </div>
    </main>
  );
}
