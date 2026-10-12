
import { Eip1193Provider } from "ethers";

interface MetaMaskProvider extends Eip1193Provider {
  on(
    event: "accountsChanged",
    listener: (accounts: string[]) => void
  ): void;

  on(
    event: "chainChanged",
    listener: (chainId: string) => void
  ): void;

  removeListener(
    event: "accountsChanged",
    listener: (accounts: string[]) => void
  ): void;

  removeListener(
    event: "chainChanged",
    listener: (chainId: string) => void
  ): void;
}

declare global {
  interface Window {
    ethereum?: MetaMaskProvider;
  }
}

export {};
