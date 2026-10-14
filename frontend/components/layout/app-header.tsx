"use client";

import { useState } from "react";
import { Bell, Check, Copy, ExternalLink, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppHeader() {
  const {
    address,
    isConnected,
    isConnecting,
    chainId,
    error,
    connectWallet,
    isCorrectNetwork,
  } = useWallet();

  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-19 items-center justify-between border-b border-white/[0.07] bg-[#09090b]/90 px-4 backdrop-blur-xl sm:px-7">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">Workspace</p>
        <p className="mt-1 hidden text-xs text-zinc-500 sm:block">
          Manage your escrow projects
        </p>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && (
          <span
            className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs sm:inline-flex ${
              isCorrectNetwork
                ? "border-emerald-400/20 bg-emerald-400/6 text-emerald-300"
                : "border-amber-400/20 bg-amber-400/6 text-amber-300"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isCorrectNetwork ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {isCorrectNetwork
              ? "Sepolia"
              : `Wrong network${chainId ? ` · ${chainId}` : ""}`}
          </span>
        )}

        {isConnected && address ? (
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/3 p-1">
            <div className="flex items-center gap-2 px-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-zinc-200">
                {shortenAddress(address)}
              </span>
            </div>

            <button
              type="button"
              onClick={copyAddress}
              aria-label="Copy wallet address"
              title="Copy address"
              className="flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/6 hover:text-white"
            >
              {copied ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>

            <a
              href={`https://sepolia.etherscan.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
              aria-label="View wallet on Etherscan"
              title="View on Etherscan"
              className="flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/6 hover:text-white"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={connectWallet}
            disabled={isConnecting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-black transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wallet className="size-4" />
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="absolute right-4 top-17 max-w-sm rounded-lg border border-red-400/20 bg-[#18181b] px-3 py-2 text-xs text-red-300 shadow-xl sm:right-7"
        >
          {error}
        </p>
      )}
    </header>
  );
}
