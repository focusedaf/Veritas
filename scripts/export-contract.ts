import { artifacts } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const artifact = await artifacts.readArtifact("Escrow");

  const outputDir = path.join(process.cwd(), "frontend", "lib", "contract");

  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, "Escrow.json"),
    JSON.stringify(
      {
        contractName: artifact.contractName,
        abi: artifact.abi,
      },
      null,
      2,
    ) + "\n",
  );

  console.log("Contract ABI exported successfully.");
  console.log("Output directory:", outputDir);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
