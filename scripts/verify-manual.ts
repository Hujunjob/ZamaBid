import { run } from "hardhat";

async function main() {
  const contractAddress = "0x7246fe641722617873360d9cf86ab85225c0eb08";
  const underlyingToken = "0xdc5A3601541518A3B52879ef5F231f6A624C93EB";
  const name = "ZamaForge";
  const symbol = "Z";
  const tokenURI = "";

  try {
    console.log("Verifying ConfidentialTokenWrapper...");
    console.log("Contract address:", contractAddress);
    console.log("Constructor arguments:");
    console.log("- underlyingToken:", underlyingToken);
    console.log("- name:", name);
    console.log("- symbol:", symbol);
    console.log("- tokenURI:", tokenURI);

    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [
        underlyingToken,
        name,
        symbol,
        tokenURI
      ],
      contract: "contracts/ConfidentialTokenWrapper.sol:ConfidentialTokenWrapper"
    });

    console.log("Verification completed successfully!");
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});