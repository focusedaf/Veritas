"use client";

import { useCallback, useEffect, useState } from "react";
import { BrowserProvider } from "ethers";

type WalletState = {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  error: string | null;
};

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    chainId: null,
    error: null,
  });

  const refreshWallet = useCallback(async () => {
    if (!window.ethereum) {
      setWallet((current) => ({
        ...current,
        address: null,
        isConnected: false,
        chainId: null,
      }));
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send("eth_accounts", []);
      const network = await provider.getNetwork();

      setWallet((current) => ({
        ...current,
        address: accounts[0] ?? null,
        isConnected: accounts.length > 0,
        chainId: Number(network.chainId),
        error: null,
      }));
    } catch {
      setWallet((current) => ({
        ...current,
        error: "Unable to read wallet information.",
      }));
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setWallet((current) => ({
        ...current,
        error: "MetaMask is not installed. Please install it to continue.",
      }));
      return;
    }

    setWallet((current) => ({
      ...current,
      isConnecting: true,
      error: null,
    }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();

      setWallet({
        address: accounts[0] ?? null,
        isConnected: accounts.length > 0,
        isConnecting: false,
        chainId: Number(network.chainId),
        error: null,
      });
    } catch (error) {
      setWallet((current) => ({
        ...current,
        isConnecting: false,
        error:
          error instanceof Error
            ? error.message
            : "Wallet connection was unsuccessful.",
      }));
    }
  }, []);

  useEffect(() => {
    void refreshWallet();

    if (!window.ethereum) return;

    const handleAccountsChanged = () => void refreshWallet();
    const handleChainChanged = () => void refreshWallet();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [refreshWallet]);

  return {
    ...wallet,
    connectWallet,
    refreshWallet,
    isCorrectNetwork: wallet.chainId === 11155111,
  };
}
