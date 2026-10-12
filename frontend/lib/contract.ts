import { BrowserProvider, Contract, type Signer } from "ethers";
import escrowArtifact from "./abi/EscrowABI.json";
import addressConfig from "./contract/address.json";

export const CONTRACT_ADDRESS = addressConfig.address;

export const ESCROW_ABI = escrowArtifact as any[];

export async function getEscrowContract(): Promise<Contract> {
  if (!window.ethereum) {
    throw new Error("Please install MetaMask first.");
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error("Escrow contract address is not configured yet.");
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer: Signer = await provider.getSigner();

  const network = await provider.getNetwork();
  
  if (network.chainId !== BigInt("11155111")) {
    throw new Error("Please switch MetaMask to the Sepolia test network.");
  }

  return new Contract(CONTRACT_ADDRESS, ESCROW_ABI, signer);
}
