import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying VeritasEscrow...");
  console.log("Deployer:", deployer.account.address);

  const escrow = await viem.deployContract("Escrow", [
    deployer.account.address,
  ]);

  console.log("Contract deployed at:", escrow.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
