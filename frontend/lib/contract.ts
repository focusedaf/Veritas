
import { BrowserProvider, Contract, type Signer } from "ethers";
import escrowArtifact from "./abi/EscrowABI.json";

export const CONTRACT_ADDRESS =
  "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";

export const ESCROW_ABI = escrowArtifact as any[];

export async function getEscrowContract(): Promise<Contract> {
  if (!window.ethereum) {
    throw new Error("Please install MetaMask first.");
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "Escrow contract address is not configured yet."
    );
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer: Signer = await provider.getSigner();

  return new Contract(CONTRACT_ADDRESS, ESCROW_ABI, signer);
}
