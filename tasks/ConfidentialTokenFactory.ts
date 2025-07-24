import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact with ConfidentialTokenFactory
 * ==========================================================
 *
 * 1. From a separate terminal window (for localhost):
 *
 *   npx hardhat node
 *
 * 2. Deploy the ConfidentialTokenFactory contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the ConfidentialTokenFactory contract
 *
 *   npx hardhat --network localhost task:factory-address
 *   npx hardhat --network localhost task:create-token --name "MyToken" --symbol "MTK"
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ============================================================
 *
 * 1. Deploy the ConfidentialTokenFactory contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the ConfidentialTokenFactory contract
 *
 *   npx hardhat --network sepolia task:factory-address
 *   npx hardhat --network sepolia task:create-token --name "MyToken" --symbol "MTK"
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:factory-address
 *   - npx hardhat --network sepolia task:factory-address
 */
task("task:factory-address", "Prints the ConfidentialTokenFactory address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const factory = await deployments.get("ConfidentialTokenFactory");

  console.log("ConfidentialTokenFactory address is " + factory.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:create-token --name "MyToken" --symbol "MTK"
 *   - npx hardhat --network sepolia task:create-token --name "MyToken" --symbol "MTK"
 */
task("task:create-token", "Creates a new ConfidentialERC20 token using the factory")
  .addOptionalParam("address", "Optionally specify the ConfidentialTokenFactory contract address")
  .addParam("name", "The name of the token to create")
  .addParam("symbol", "The symbol of the token to create")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const name = taskArguments.name;
    const symbol = taskArguments.symbol;
    const supply = 10000;

    if (!name || !symbol) {
      throw new Error("Both --name and --symbol parameters are required");
    }

    const factoryDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ConfidentialTokenFactory");
    console.log(`ConfidentialTokenFactory: ${factoryDeployment.address}`);

    const signers = await ethers.getSigners();

    const factoryContract = await ethers.getContractAt("ConfidentialTokenFactory", factoryDeployment.address);

    console.log(`Creating token with name: "${name}" and symbol: "${symbol}"`);

    const tx = await factoryContract
      .connect(signers[0])
      .createToken(name, symbol,supply);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    // Parse the TokenCreated event to get the new token address
    const events = receipt?.logs;
    // console.log(events);
    if (events && events.length > 0) {
      try {
        const tokenCreatedEvent = factoryContract.interface.parseLog(events[events.length-1]);
        // console.log("tokenCreatedEvent",tokenCreatedEvent);
        if (tokenCreatedEvent && tokenCreatedEvent.name === "TokenCreated") {
          const tokenAddress = tokenCreatedEvent.args.tokenAddress;
          console.log(`New ConfidentialERC20 token created at address: ${tokenAddress}`);
          console.log(`Token name: ${name}`);
          console.log(`Token symbol: ${symbol}`);
        }
      } catch {
        console.log("Could not parse TokenCreated event, but transaction succeeded");
      }
    }
    
    console.log(`ConfidentialTokenFactory createToken("${name}", "${symbol}") succeeded!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-token-info --token 0x123...
 *   - npx hardhat --network sepolia task:get-token-info --token 0x123...
 */
task("task:get-token-info", "Gets information about a ConfidentialERC20 token")
  .addParam("token", "The address of the ConfidentialERC20 token")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;

    const tokenAddress = taskArguments.token;

    if (!tokenAddress) {
      throw new Error("--token parameter is required");
    }

    const tokenContract = await ethers.getContractAt("ConfidentialToken", tokenAddress);

    try {
      const name = await tokenContract.name();
      const symbol = await tokenContract.symbol();
      const owner = await tokenContract.owner();

      console.log(`Token Address: ${tokenAddress}`);
      console.log(`Token Name: ${name}`);
      console.log(`Token Symbol: ${symbol}`);
      console.log(`Token Owner: ${owner}`);
    } catch (err) {
      console.log(`Error getting token info: ${err}`);
    }
  });