import { run } from "hardhat";

async function main() {
  const contracts = [
    {
      name: "ConfidentialTokenFactory",
      address: "0x8d3F4e8fe379dBEA133420Eb6Be79033A0e78593",
      constructorArguments: []
    },
    {
      name: "TestCoin", 
      address: "0xdc5A3601541518A3B52879ef5F231f6A624C93EB",
      constructorArguments: ["ZamaForge", "Z", "1000000000000000000000000000"]
    },
    {
      name: "Airdrop",
      address: "0x6dB435EFe22787b6CC4E0DDAb8a6281a8a6E04F1",
      constructorArguments: []
    }
  ];

  for (const contract of contracts) {
    console.log(`\nVerifying ${contract.name} at ${contract.address}...`);
    try {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.constructorArguments,
      });
      console.log(`✅ ${contract.name} verified successfully!`);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`✅ ${contract.name} is already verified!`);
      } else {
        console.log(`❌ Failed to verify ${contract.name}:`, error.message);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });