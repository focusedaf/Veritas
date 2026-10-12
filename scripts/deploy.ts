import { network } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

  const actualArbitrator = await escrow.read.arbitrator();

  console.log("Escrow deployed at:", escrow.address);
  console.log("Configured arbitrator:", actualArbitrator);

  const outputDir = path.join(process.cwd(), "frontend", "lib", "contract");

  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, "address.json"),
    JSON.stringify(
      {
        network: process.env.DEPLOYMENT_NETWORK ?? "localhost",
        address: escrow.address,
      },
      null,
      2,
    ) + "\n",
  );

  console.log("Contract address exported successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
