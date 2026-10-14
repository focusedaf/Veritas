"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useProjects } from "@/hooks/use-projects";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname === "/projects") return "Projects";
  if (pathname === "/projects/new") return "New project";
  if (pathname.startsWith("/projects/")) return "Project";
  if (pathname === "/activity") return "Activity";
  return "Veritas";
}

export function AppHeader() {
  const pathname = usePathname();

  const {
    address,
    isConnected,
    isConnecting,
    chainId,
    error: walletError,
    connectWallet,
    isCorrectNetwork,
  } = useWallet();

  const {
    isLoading,
    latestBlock,
    refreshAll,
    withdrawable,
    isWithdrawing,
    withdraw,
    actionError,
  } = useProjects();

  const [copied, setCopied] = useState(false);

  const balance = Number(withdrawable);
  const hasBalance = Number.isFinite(balance) && balance > 0;
  const error = actionError || walletError;

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
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#09090b]/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <h1 className="shrink-0 text-sm font-semibold text-white sm:text-base">
        {pageTitle(pathname)}
      </h1>

      <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isConnected && isCorrectNetwork && (
          <>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={isLoading}
              aria-label="Sync with blockchain"
              title={
                latestBlock !== null
                  ? `Synced to block ${latestBlock.toLocaleString()}`
                  : "Sync with blockchain"
              }
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
            >
              <RefreshCw
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>

            <div className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] pl-3 pr-1.5">
              <span className="hidden text-xs text-zinc-500 sm:inline">
                Balance
              </span>

              <span className="text-xs font-medium text-zinc-100">
                {Number.isFinite(balance)
                  ? balance.toLocaleString("en-US", {
                      maximumFractionDigits: 4,
                    })
                  : "0"}{" "}
                ETH
              </span>

              {hasBalance && (
                <button
                  type="button"
                  onClick={() => void withdraw()}
                  disabled={isWithdrawing}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-emerald-400 px-2.5 text-xs font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60"
                >
                  {isWithdrawing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="size-3.5" />
                  )}
                  Withdraw
                </button>
              )}
            </div>
          </>
        )}

        {isConnected && (
          <span
            title={isCorrectNetwork ? "Sepolia" : `Wrong network · ${chainId}`}
            className={`hidden h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs sm:inline-flex ${
              isCorrectNetwork
                ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                : "border-amber-400/20 bg-amber-400/[0.06] text-amber-300"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isCorrectNetwork ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {isCorrectNetwork ? "Sepolia" : "Wrong network"}
          </span>
        )}

        {isConnected && address ? (
          <div className="flex h-9 shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.03] pl-2.5 pr-1">
            <span className="text-xs font-medium text-zinc-200">
              {shortenAddress(address)}
            </span>

            <button
              type="button"
              onClick={() => void copyAddress()}
              aria-label="Copy wallet address"
              title="Copy address"
              className="ml-1 flex size-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>

            <a
              href={`https://sepolia.etherscan.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
              aria-label="View wallet on Etherscan"
              title="View on Etherscan"
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void connectWallet()}
            disabled={isConnecting}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wallet className="size-3.5" />
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="absolute right-4 top-full mt-2 max-w-[calc(100vw-2rem)] rounded-lg border border-red-400/20 bg-[#18181b] px-3 py-2 text-xs text-red-300 shadow-xl sm:right-6 sm:max-w-sm"
        >
          {error}
        </p>
      )}
    </header>
  );
}
