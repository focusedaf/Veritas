import type { ContractTransactionResponse, TransactionReceipt } from "ethers";

export type TransactionResult = {
  hash: string;
  receipt: TransactionReceipt;
};

export async function waitForTransaction(
  transaction: ContractTransactionResponse,
): Promise<TransactionResult> {
  const receipt = await transaction.wait();

  if (!receipt) {
    throw new Error("The transaction was not confirmed.");
  }

  if (receipt.status !== 1) {
    throw new Error("The transaction failed on-chain.");
  }

  return {
    hash: transaction.hash,
    receipt,
  };
}
