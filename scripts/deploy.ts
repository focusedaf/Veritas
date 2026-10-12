import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const [deployer, arbitrator] = await viem.getWalletClients();

  if (!deployer || !arbitrator) {
    throw new Error("Deployer and arbitrator accounts are required.");
  }

  if (
    deployer.account.address.toLowerCase() ===
    arbitrator.account.address.toLowerCase()
  ) {
    throw new Error("Deployer and arbitrator must be different accounts.");
  }

  console.log("Deploying Escrow...");
  console.log("Deployer:", deployer.account.address);
  console.log("Arbitrator:", arbitrator.account.address);

  const escrow = await viem.deployContract("Escrow", [
    arbitrator.account.address,
  ]);

  console.log("Contract deployed at:", escrow.address);
  console.log("Arbitrator address:", await escrow.read.arbitrator());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
