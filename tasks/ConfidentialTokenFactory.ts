import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

/**
 * Deploy ConfidentialTokenFactory contract
 * Example: npx hardhat --network localhost task:deploy-factory
 */
task("task:deploy-factory", "Deploy the ConfidentialTokenFactory contract")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    console.log("Deploying ConfidentialTokenFactory...");

    const ConfidentialTokenFactory = await ethers.getContractFactory("ConfidentialTokenFactory");
    const factory = await ConfidentialTokenFactory.deploy();
    await factory.waitForDeployment();

    const factoryAddress = await factory.getAddress();
    console.log(`ConfidentialTokenFactory deployed to: ${factoryAddress}`);

    return factoryAddress;
  });

/**
 * Wrap ERC20 tokens to create confidential tokens
 * Example: npx hardhat --network localhost task:wrap-erc20 --factory 0x123... --token 0x456... --amount 1000000000000000000
 */
task("task:wrap-erc20", "Wrap ERC20 tokens into confidential tokens")
  .addParam("factory", "The address of the ConfidentialTokenFactory")
  .addParam("token", "The address of the ERC20 token to wrap")
  .addParam("amount", "The amount to wrap (in wei)")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;

    const factoryAddress = taskArguments.factory;
    const tokenAddress = taskArguments.token;
    const amount = ethers.parseEther(taskArguments.amount);
    const userIndex = parseInt(taskArguments.user);

    if (!factoryAddress || !tokenAddress || !amount) {
      throw new Error("--factory, --token, and --amount parameters are required");
    }

    const signers = await ethers.getSigners();
    const user = signers[userIndex];

    console.log(`Wrapping ${amount} tokens from ${tokenAddress} using factory ${factoryAddress}`);
    console.log(`User: ${user.address}`);

    // Get contracts
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", factoryAddress);
    const erc20Token = await ethers.getContractAt("ERC20", tokenAddress);

    try {
      // Check user balance
      const userBalance = await erc20Token.balanceOf(user.address);
      console.log(`User ERC20 balance: ${userBalance.toString()}`);

      const factoryBalance = await erc20Token.balanceOf(factoryAddress);
      console.log(`factoryBalance ERC20 balance: ${factoryBalance.toString()}`);

      if (userBalance < BigInt(amount)) {
        throw new Error("Insufficient ERC20 balance");
      }

      // Approve factory to spend tokens
      console.log("Approving factory to spend tokens...");
      const approveTx = await erc20Token.connect(user).approve(factoryAddress, amount);
      await approveTx.wait();
      console.log("Approval successful");

      // Wrap tokens
      console.log("Wrapping tokens...");
      const wrapTx = await factory.connect(user).wrapERC20(tokenAddress, amount);
      const receipt = await wrapTx.wait();

      console.log(`Wrap transaction hash: ${receipt?.hash}`);

      // Get the confidential token address
      const confidentialTokenAddress = await factory.getConfidentialToken(tokenAddress);
      console.log(`Confidential token created/updated at: ${confidentialTokenAddress}`);

      return confidentialTokenAddress;

    } catch (error) {
      console.error(`Error wrapping tokens: ${error}`);
      throw error;
    }
  });

/**
 * Unwrap confidential tokens back to ERC20
 * Example: npx hardhat --network localhost task:unwrap --factory 0x123... --confidential-token 0x456... --amount 1000000
 */
task("task:unwrap", "Unwrap confidential tokens back to ERC20")
  .addParam("cftoken", "The address of the confidential token")
  .addParam("amount", "The amount to unwrap (in confidential token units)")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const confidentialTokenAddress = taskArguments.cftoken;
    const amount = parseInt(taskArguments.amount) * 1000000;
    const userIndex = parseInt(taskArguments.user);

    if (!confidentialTokenAddress || !amount) {
      throw new Error("--factory, --confidential-token, and --amount parameters are required");
    }

    const signers = await ethers.getSigners();
    const user = signers[userIndex];

    console.log(`Unwrapping ${amount} confidential tokens from ${confidentialTokenAddress}`);
    console.log(`User: ${user.address}`);

    try {
      // Get contracts
      const cfToken = await ethers.getContractAt("ConfidentialTokenWrapper", confidentialTokenAddress);

      // Create encrypted input for the amount
      const input = fhevm.createEncryptedInput(confidentialTokenAddress, user.address);
      input.add64(BigInt(amount));
      const encryptedInput = await input.encrypt();

      console.log("Created encrypted input for amount");
      //   function unwrap(
      // address from,
      // address to,
      // externalEuint64 encryptedAmount,
      // bytes calldata inputProof
      // function unwrap(
      //     address from,
      //     address to,
      //     externalEuint64 encryptedAmount,
      //     bytes calldata inputProof
      // Unwrap tokens
      console.log("Unwrapping tokens...");
      const unwrapTx = await cfToken["unwrap(address,address,bytes32,bytes)"](
        user.address,
        user.address,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      const receipt = await unwrapTx.wait();

      console.log(`Unwrap transaction hash: ${receipt?.hash}`);

      // Get the normal token address
      const normalTokenAddress = await cfToken.underlying();
      console.log(`Normal token address: ${normalTokenAddress}`);

      return normalTokenAddress;

    } catch (error) {
      console.error(`Error unwrapping tokens: ${error}`);
      throw error;
    }
  });

/**
 * Get confidential token address for a given ERC20
 * Example: npx hardhat --network localhost task:get-confidential-token --factory 0x123... --token 0x456...
 */
task("task:get-confidential-token", "Get the confidential token address for an ERC20 token")
  .addParam("factory", "The address of the ConfidentialTokenFactory")
  .addParam("token", "The address of the ERC20 token")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;

    const factoryAddress = taskArguments.factory;
    const tokenAddress = taskArguments.token;

    if (!factoryAddress || !tokenAddress) {
      throw new Error("--factory and --token parameters are required");
    }

    const factory = await ethers.getContractAt("ConfidentialTokenFactory", factoryAddress);

    try {
      const confidentialTokenAddress = await factory.getConfidentialToken(tokenAddress);

      if (confidentialTokenAddress === ethers.ZeroAddress) {
        console.log(`No confidential token found for ERC20: ${tokenAddress}`);
        return null;
      }

      console.log(`ERC20 token: ${tokenAddress}`);
      console.log(`Confidential token: ${confidentialTokenAddress}`);

      return confidentialTokenAddress;

    } catch (error) {
      console.error(`Error getting confidential token: ${error}`);
      throw error;
    }
  });

/**
 * Get ERC20 token address for a given confidential token
 * Example: npx hardhat --network localhost task:get-erc20-token --factory 0x123... --confidential-token 0x456...
 */
task("task:get-erc20-token", "Get the ERC20 token address for a confidential token")
  .addParam("factory", "The address of the ConfidentialTokenFactory")
  .addParam("confidentialToken", "The address of the confidential token")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;

    const factoryAddress = taskArguments.factory;
    const confidentialTokenAddress = taskArguments.confidentialToken;

    if (!factoryAddress || !confidentialTokenAddress) {
      throw new Error("--factory and --confidential-token parameters are required");
    }

    const factory = await ethers.getContractAt("ConfidentialTokenFactory", factoryAddress);

    try {
      const erc20TokenAddress = await factory.getERC20(confidentialTokenAddress);

      if (erc20TokenAddress === ethers.ZeroAddress) {
        console.log(`No ERC20 token found for confidential token: ${confidentialTokenAddress}`);
        return null;
      }

      console.log(`Confidential token: ${confidentialTokenAddress}`);
      console.log(`ERC20 token: ${erc20TokenAddress}`);

      return erc20TokenAddress;

    } catch (error) {
      console.error(`Error getting ERC20 token: ${error}`);
      throw error;
    }
  });

/**
 * Get factory information and token mappings
 * Example: npx hardhat --network localhost task:factory-info --factory 0x123...
 */
task("task:factory-info", "Get general information about the ConfidentialTokenFactory")
  .addParam("factory", "The address of the ConfidentialTokenFactory")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;

    const factoryAddress = taskArguments.factory;

    if (!factoryAddress) {
      throw new Error("--factory parameter is required");
    }

    const factory = await ethers.getContractAt("ConfidentialTokenFactory", factoryAddress);

    try {
      console.log(`ConfidentialTokenFactory Address: ${factoryAddress}`);
      console.log(`Factory contract deployed successfully`);

      // Try to get some basic info (note: the current contract doesn't have methods to enumerate all tokens)
      console.log(`\nNote: Use get-confidential-token or get-erc20-token tasks to query specific token mappings`);

    } catch (error) {
      console.error(`Error getting factory info: ${error}`);
      throw error;
    }
  });

/**
 * Check confidential token balance
 * Example: npx hardhat --network localhost task:check-balance --confidential-token 0x123... --user 0
 */
task("task:check-balance", "Check encrypted balance of a confidential token")
  .addParam("cftoken", "The address of the confidential token")
  .addOptionalParam("user", "User index (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const confidentialTokenAddress = taskArguments.cftoken;
    const userIndex = parseInt(taskArguments.user);

    if (!confidentialTokenAddress) {
      throw new Error("--confidential-token parameter is required");
    }

    const signers = await ethers.getSigners();
    const user = signers[userIndex];

    console.log(`Checking balance for user: ${user.address}`);
    console.log(`Confidential token: ${confidentialTokenAddress}`);

    try {
      const confidentialToken = await ethers.getContractAt("ConfidentialTokenWrapper", confidentialTokenAddress);

      // Get encrypted balance
      const encryptedBalance = await confidentialToken.confidentialBalanceOf(user.address);
      console.log(`Encrypted balance handle: ${encryptedBalance}`);

      // Decrypt balance (user needs permission)
      try {
        const clearBalance = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          encryptedBalance,
          confidentialTokenAddress,
          user
        );
        console.log(`Decrypted balance: ${clearBalance}`);
      } catch (decryptError) {
        console.log(`Could not decrypt balance (user may not have permission): ${decryptError}`);
      }

    } catch (error) {
      console.error(`Error checking balance: ${error}`);
      throw error;
    }
  });