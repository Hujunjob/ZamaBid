import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Example:
 *   - npx hardhat --network localhost task:deploy-airdrop
 *   - npx hardhat --network sepolia task:deploy-airdrop
 */
task("task:deploy-airdrop", "Deploy Airdrop contract")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    console.log("Deploying Airdrop contract...");
    console.log("Deployer address:", deployer.address);

    const AirdropFactory = await ethers.getContractFactory("Airdrop");
    const airdrop = await AirdropFactory.deploy();
    await airdrop.waitForDeployment();

    const airdropAddress = await airdrop.getAddress();
    console.log(`Airdrop contract deployed to: ${airdropAddress}`);
    console.log(`Owner: ${deployer.address}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:claim-tokens --airdrop 0x123... --token 0x456...
 *   - npx hardhat --network sepolia task:claim-tokens --airdrop 0x123... --token 0x456...
 */
task("task:claim-tokens", "Claim tokens from airdrop")
  .addParam("airdrop", "The address of the Airdrop contract")
  .addParam("token", "The address of the token to claim")
  .addOptionalParam("user", "The index of the user (default: 0)", "0")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const signers = await ethers.getSigners();
    const userIndex = parseInt(taskArguments.user);
    const user = signers[userIndex];
    // console.log("userindex:", userIndex, user);


    const airdropAddress = taskArguments.airdrop;
    const tokenAddress = taskArguments.token;

    if (!airdropAddress || !tokenAddress) {
      throw new Error("--airdrop and --token parameters are required");
    }

    const airdrop = await ethers.getContractAt("Airdrop", airdropAddress);
    const token = await ethers.getContractAt("TestCoin", tokenAddress);

    console.log(`Claiming tokens for user: ${user.address}`);
    console.log(`Airdrop contract: ${airdropAddress}`);
    console.log(`Token contract: ${tokenAddress}`);

    try {
      // Check token balance before claim
      const balanceBefore = await token.balanceOf(user.address);
      console.log(`User token balance before claim: ${ethers.formatEther(balanceBefore)}`);

      // Check airdrop contract token balance
      const airdropBalance = await airdrop.getTokenBalance(tokenAddress);
      console.log(`Airdrop contract token balance: ${ethers.formatEther(airdropBalance)}`);

      // Claim tokens (pay 0.001 ETH)
      const tx = await airdrop.connect(user).claimTokens(tokenAddress, {
        value: ethers.parseEther("0.001")
      });
      console.log(`Transaction hash: ${tx.hash}`);
      await tx.wait();

      // Check token balance after claim
      const balanceAfter = await token.balanceOf(user.address);
      console.log(`User token balance after claim: ${ethers.formatEther(balanceAfter)}`);
      console.log(`Tokens claimed: ${ethers.formatEther(balanceAfter - balanceBefore)}`);

    } catch (err) {
      console.log(`Error claiming tokens: ${err}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:airdrop-info --airdrop 0x123...
 */
task("task:airdrop-info", "Get airdrop contract information")
  .addParam("airdrop", "The address of the Airdrop contract")
  .addOptionalParam("token", "The address of the token to check balance")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;

    const airdropAddress = taskArguments.airdrop;
    if (!airdropAddress) {
      throw new Error("--airdrop parameter is required");
    }

    const airdrop = await ethers.getContractAt("Airdrop", airdropAddress);

    try {
      const owner = await airdrop.owner();
      const claimAmount = await airdrop.CLAIM_AMOUNT();
      const claimFee = await airdrop.CLAIM_FEE();
      const ethBalance = await ethers.provider.getBalance(airdropAddress);

      console.log(`Airdrop Contract: ${airdropAddress}`);
      console.log(`Owner: ${owner}`);
      console.log(`Claim Amount: ${ethers.formatEther(claimAmount)} tokens`);
      console.log(`Claim Fee: ${ethers.formatEther(claimFee)} ETH`);
      console.log(`Contract ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

      if (taskArguments.token) {
        const tokenBalance = await airdrop.getTokenBalance(taskArguments.token);
        console.log(`Token Balance (${taskArguments.token}): ${ethers.formatEther(tokenBalance)} tokens`);
      }

    } catch (err) {
      console.log(`Error getting airdrop info: ${err}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:withdraw-fees --airdrop 0x123...
 */
task("task:withdraw-fees", "Withdraw fees from airdrop contract (owner only)")
  .addParam("airdrop", "The address of the Airdrop contract")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const signers = await ethers.getSigners();
    const owner = signers[0];

    const airdropAddress = taskArguments.airdrop;
    if (!airdropAddress) {
      throw new Error("--airdrop parameter is required");
    }

    const airdrop = await ethers.getContractAt("Airdrop", airdropAddress);

    try {
      const ethBalanceBefore = await ethers.provider.getBalance(airdropAddress);
      console.log(`Contract ETH balance before withdrawal: ${ethers.formatEther(ethBalanceBefore)} ETH`);

      const tx = await airdrop.connect(owner).withdrawFees();
      console.log(`Transaction hash: ${tx.hash}`);
      await tx.wait();

      const ethBalanceAfter = await ethers.provider.getBalance(airdropAddress);
      console.log(`Contract ETH balance after withdrawal: ${ethers.formatEther(ethBalanceAfter)} ETH`);
      console.log(`Fees withdrawn: ${ethers.formatEther(ethBalanceBefore - ethBalanceAfter)} ETH`);

    } catch (err) {
      console.log(`Error withdrawing fees: ${err}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:fund-airdrop --airdrop 0x123... --token 0x456... --amount 1000
 */
task("task:fund-airdrop", "Fund airdrop contract with tokens")
  .addParam("airdrop", "The address of the Airdrop contract")
  .addParam("token", "The address of the token to fund")
  .addParam("amount", "The amount of tokens to fund (in ether units)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const signers = await ethers.getSigners();
    const funder = signers[0];

    const airdropAddress = taskArguments.airdrop;
    const tokenAddress = taskArguments.token;
    const amount = taskArguments.amount;

    if (!airdropAddress || !tokenAddress || !amount) {
      throw new Error("--airdrop, --token, and --amount parameters are required");
    }

    const token = await ethers.getContractAt("TestCoin", tokenAddress);
    const amountToSend = ethers.parseEther(amount);

    try {
      console.log(`Funding airdrop contract with ${amount} tokens...`);
      console.log(`From: ${funder.address}`);
      console.log(`To: ${airdropAddress}`);
      console.log(`Token: ${tokenAddress}`);

      const tx = await token.connect(funder).transfer(airdropAddress, amountToSend);
      console.log(`Transaction hash: ${tx.hash}`);
      await tx.wait();

      const airdrop = await ethers.getContractAt("Airdrop", airdropAddress);
      const newBalance = await airdrop.getTokenBalance(tokenAddress);
      console.log(`Airdrop contract new token balance: ${ethers.formatEther(newBalance)} tokens`);

    } catch (err) {
      console.log(`Error funding airdrop: ${err}`);
    }
  });