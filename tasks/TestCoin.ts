import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";
/**
 * Deploy TestCoin ERC20 token
 * Example: npx hardhat --network localhost task:deploy-testcoin --name "Test Coin" --symbol "TEST" --supply 1000000
 */
task("task:deploy-testcoin", "Deploy a new TestCoin ERC20 token")
  .addParam("name", "The name of the token")
  .addParam("symbol", "The symbol of the token")
  .addParam("supply", "The initial supply of tokens")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying TestCoin with account:", deployer.address);
    
    const TestCoin = await ethers.getContractFactory("TestCoin");
    const testCoin = await TestCoin.deploy(
      taskArguments.name,
      taskArguments.symbol,
      ethers.parseEther(taskArguments.supply)
    );
    
    await testCoin.waitForDeployment();
    const address = await testCoin.getAddress();
    
    console.log(`TestCoin deployed to: ${address}`);
    console.log(`Name: ${taskArguments.name}`);
    console.log(`Symbol: ${taskArguments.symbol}`);
    console.log(`Initial Supply: ${taskArguments.supply} tokens`);
    console.log(`Deployer Balance: ${ethers.formatEther(await testCoin.balanceOf(deployer.address))} tokens`);
  });

/**
 * Mint TestCoin tokens (only works if caller has minting rights)
 * Example: npx hardhat --network localhost task:mint-testcoin --token 0x123... --to 0x456... --amount 1000
 */
task("task:mint-testcoin", "Mint TestCoin tokens")
  .addParam("token", "The address of the TestCoin contract")
  .addParam("to", "The address to mint tokens to")
  .addParam("amount", "The amount of tokens to mint")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const [signer] = await ethers.getSigners();
    const testCoin = await ethers.getContractAt("TestCoin", taskArguments.token);
    
    const mintAmount = ethers.parseEther(taskArguments.amount);
    
    try {
      // TestCoin is a simple ERC20, so we need to manually mint by calling _mint
      // Since _mint is internal, we'll need to add a public mint function or use transfer from deployer
      const deployerBalance = await testCoin.balanceOf(signer.address);
      
      if (deployerBalance < mintAmount) {
        throw new Error(`Insufficient balance. Deployer has ${ethers.formatEther(deployerBalance)} tokens`);
      }
      
      // Transfer tokens from deployer to target address
      const tx = await testCoin.transfer(taskArguments.to, mintAmount);
      await tx.wait();
      
      console.log(`Transferred ${taskArguments.amount} tokens to ${taskArguments.to}`);
      console.log(`Transaction hash: ${tx.hash}`);
      console.log(`New balance of ${taskArguments.to}: ${ethers.formatEther(await testCoin.balanceOf(taskArguments.to))} tokens`);
    } catch (error) {
      console.error(`Error minting tokens: ${error}`);
    }
  });

/**
 * Transfer TestCoin tokens
 * Example: npx hardhat --network localhost task:transfer-testcoin --token 0x123... --to 0x456... --amount 100
 */
task("task:transfer-testcoin", "Transfer TestCoin tokens")
  .addParam("token", "The address of the TestCoin contract")
  .addParam("to", "The address to transfer tokens to")
  .addParam("amount", "The amount of tokens to transfer")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const [signer] = await ethers.getSigners();
    const testCoin = await ethers.getContractAt("TestCoin", taskArguments.token);
    
    const transferAmount = ethers.parseEther(taskArguments.amount);
    
    try {
      const balanceBefore = await testCoin.balanceOf(signer.address);
      console.log(`Sender balance before: ${ethers.formatEther(balanceBefore)} tokens`);
      
      const tx = await testCoin.transfer(taskArguments.to, transferAmount);
      await tx.wait();
      
      const balanceAfter = await testCoin.balanceOf(signer.address);
      const recipientBalance = await testCoin.balanceOf(taskArguments.to);
      
      console.log(`Transfer successful!`);
      console.log(`Transaction hash: ${tx.hash}`);
      console.log(`Sender balance after: ${ethers.formatEther(balanceAfter)} tokens`);
      console.log(`Recipient balance: ${ethers.formatEther(recipientBalance)} tokens`);
    } catch (error) {
      console.error(`Error transferring tokens: ${error}`);
    }
  });

/**
 * Wrap ERC20 tokens to ConfidentialToken using ConfidentialTokenFactory
 * Example: npx hardhat --network localhost task:wrap-erc20 --factory 0x123... --erc20 0x456... --amount 100
 */
task("task:wrap-erc20", "Wrap ERC20 tokens to ConfidentialToken")
  .addParam("factory", "The address of the ConfidentialTokenFactory contract")
  .addParam("erc20", "The address of the ERC20 token to wrap")
  .addParam("amount", "The amount of tokens to wrap (in whole tokens)")
  .addParam("user","user index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const signers = await ethers.getSigners();
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", taskArguments.factory);
    const erc20 = await ethers.getContractAt("TestCoin", taskArguments.erc20);
    const userIndex = taskArguments.user
    const signer = signers[userIndex]
    
    const wrapAmount = ethers.parseEther(taskArguments.amount);
    
    try {
      // Check if user has enough tokens
      const balance = await erc20.balanceOf(signer.address);
      console.log(`ERC20 balance: ${ethers.formatEther(balance)} tokens`);
      
      if (balance < wrapAmount) {
        throw new Error(`Insufficient balance. You have ${ethers.formatEther(balance)} tokens`);
      }
      
      // Check if factory already has a confidential token for this ERC20
      let confidentialTokenAddress = await factory.confidentialTokens(taskArguments.erc20);
      
      if (confidentialTokenAddress === ethers.ZeroAddress) {
        console.log("No existing ConfidentialToken found, will create new one during wrap");
      } else {
        console.log(`Existing ConfidentialToken found at: ${confidentialTokenAddress}`);
      }
      
      // Approve factory to spend tokens
      console.log(`Approving factory to spend ${taskArguments.amount} tokens...`);
      const approveTx = await erc20.approve(taskArguments.factory, wrapAmount);
      await approveTx.wait();
      console.log(`Approval successful. Transaction hash: ${approveTx.hash}`);
      
      // Wrap tokens
      console.log(`Wrapping ${taskArguments.amount} tokens...`);
      console.log("taskArguments.erc20 %s,wrapAmount:%s",taskArguments.erc20,wrapAmount);
      
      const wrapTx = await factory.wrapERC20(taskArguments.erc20, wrapAmount);
      await wrapTx.wait();
      
      // Get the confidential token address
      confidentialTokenAddress = await factory.confidentialTokens(taskArguments.erc20);
      
      console.log(`Wrap successful!`);
      console.log(`Transaction hash: ${wrapTx.hash}`);
      console.log(`ConfidentialToken address: ${confidentialTokenAddress}`);
      console.log(`Wrapped amount: ${taskArguments.amount} tokens`);
      
      // Check new balances
      const newERC20Balance = await erc20.balanceOf(signer.address);
      console.log(`New ERC20 balance: ${ethers.formatEther(newERC20Balance)} tokens`);
      
    } catch (error) {
      console.error(`Error wrapping tokens: ${error}`);
    }
  });

/**
 * Get token information for both ERC20 and ConfidentialToken
 * Example: npx hardhat --network localhost task:get-token-info --erc20 0x123... --factory 0x456...
 */
task("task:get-token-info", "Get information about ERC20 and its corresponding ConfidentialToken")
  .addParam("erc20", "The address of the ERC20 token")
  .addParam("factory", "The address of the ConfidentialTokenFactory contract")
  .addParam("user","user index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const signers = await ethers.getSigners();
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", taskArguments.factory);
    const erc20 = await ethers.getContractAt("TestCoin", taskArguments.erc20);
    const userIndex = taskArguments.user
    
    try {
      // ERC20 token info
      const name = await erc20.name();
      const symbol = await erc20.symbol();
      const totalSupply = await erc20.totalSupply();
      const userBalance = await erc20.balanceOf(signers[userIndex].address);
      
      console.log("=== ERC20 Token Info ===");
      console.log(`Address: ${taskArguments.erc20}`);
      console.log(`Name: ${name}`);
      console.log(`Symbol: ${symbol}`);
      console.log(`Total Supply: ${ethers.formatEther(totalSupply)} tokens`);
      console.log(`Your Balance: ${ethers.formatEther(userBalance)} tokens`);
      
      // ConfidentialToken info
      const confidentialTokenAddress = await factory.confidentialTokens(taskArguments.erc20);
      
      console.log("\n=== ConfidentialToken Info ===");
      if (confidentialTokenAddress === ethers.ZeroAddress) {
        console.log("No ConfidentialToken exists for this ERC20 yet");
      } else {
        const confidentialToken = await ethers.getContractAt("ConfidentialToken", confidentialTokenAddress);
        const cfName = await confidentialToken.name();
        const cfSymbol = await confidentialToken.symbol();
        const cfOwner = await confidentialToken.owner();
        
        console.log(`Address: ${confidentialTokenAddress}`);
        console.log(`Name: ${cfName}`);
        console.log(`Symbol: ${cfSymbol}`);
        console.log(`Owner: ${cfOwner}`);
      }
      
    } catch (error) {
      console.error(`Error getting token info: ${error}`);
    }
  });


/**
 * Get token information for both ERC20 and ConfidentialToken
 * Example: npx hardhat --network localhost task:get-token-info --erc20 0x123... --factory 0x456...
 */
task("task:get-wrap-info", "Get information about ERC20 and its corresponding ConfidentialToken")
  .addParam("cftoken", "The address of the ConfidentialToken contract")
  .addParam("user","user index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
     const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const signers = await ethers.getSigners();
    const cftoken = await ethers.getContractAt("ConfidentialToken", taskArguments.cftoken);
    const userIndex = taskArguments.user
    const signer = signers[userIndex]

    try {
      // ERC20 token info
      const name = await cftoken.name();
      const symbol = await cftoken.symbol();
      const totalSupply = await cftoken.totalSupply();
      const euserBalance = await cftoken.balanceOf(signers[userIndex].address);
      
      console.log("=== ERC20 Token Info ===");
      console.log(`Name: ${name}`);
      console.log(`Symbol: ${symbol}`);
      console.log(`Total Supply: ${(totalSupply)} tokens`);
      console.log(`Your Balance: ${(euserBalance)} tokens`);


          const clearCount = await fhevm.userDecryptEuint(
            FhevmType.euint64,
            euserBalance,
            taskArguments.cftoken,
            signers[0],
          );
          console.log(`Clear count    : ${clearCount}`);
      
    } catch (error) {
      console.error(`Error getting token info: ${error}`);
    }
  });

/**
 * Unwrap ConfidentialToken back to ERC20 tokens
 * Example: npx hardhat --network localhost task:unwrap-token --factory 0x123... --cftoken 0x456... --amount 50 --user 0
 */
task("task:unwrap-token", "Unwrap ConfidentialToken back to ERC20 tokens")
  .addParam("factory", "The address of the ConfidentialTokenFactory contract")
  .addParam("cftoken", "The address of the ConfidentialToken to unwrap")
  .addParam("amount", "The amount of ConfidentialTokens to unwrap")
  .addParam("user", "User index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const signers = await ethers.getSigners();
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", taskArguments.factory);
    const userIndex = parseInt(taskArguments.user);
    const signer = signers[userIndex];
    
    const unwrapAmount = parseInt(taskArguments.amount);
    
    try {
      // Get the corresponding ERC20 token address
      const erc20Address = await factory.getERC20(taskArguments.cftoken);
      if (erc20Address === ethers.ZeroAddress) {
        throw new Error("No corresponding ERC20 token found for this ConfidentialToken");
      }
      
      console.log(`ERC20 token address: ${erc20Address}`);
      console.log(`Starting unwrap process for ${unwrapAmount} tokens...`);
      
      // Check if user has pending unwrap request
      const existingRequestId = await factory.usersUnwrapRequests(signer.address);
      if (existingRequestId > 0) {
        throw new Error("You already have a pending unwrap request. Please confirm or wait for it to complete.");
      }
      
      // Start unwrap process
      const unwrapTx = await factory.connect(signer).unwarp(taskArguments.cftoken, unwrapAmount);
      await unwrapTx.wait();
      
      console.log(`Unwrap request initiated successfully!`);
      console.log(`Transaction hash: ${unwrapTx.hash}`);
      console.log(`Please wait for the decryption callback to be processed...`);
      console.log(`Then call task:confirm-unwrap to complete the process.`);
      
      // Get the request ID
      const requestId = await factory.usersUnwrapRequests(signer.address);
      console.log(`Request ID: ${requestId}`);
      
    } catch (error) {
      console.error(`Error unwrapping tokens: ${error}`);
    }
  });

/**
 * Confirm unwrap after decryption callback
 * Example: npx hardhat --network localhost task:confirm-unwrap --factory 0x123... --user 0
 */
task("task:confirm-unwrap", "Confirm unwrap after decryption callback is processed")
  .addParam("factory", "The address of the ConfidentialTokenFactory contract")
  .addParam("user", "User index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const signers = await ethers.getSigners();
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", taskArguments.factory);
    const userIndex = parseInt(taskArguments.user);
    const signer = signers[userIndex];
    
    try {
      // Check if user has a pending request
      const requestId = await factory.usersUnwrapRequests(signer.address);
      if (requestId === 0n) {
        throw new Error("No pending unwrap request found");
      }
      
      console.log(`Found pending request ID: ${requestId}`);
      
      // Get request details
      const request = await factory.unwrapRequestIds(requestId);
      if (!request.hasCallback) {
        throw new Error("Decryption callback has not been processed yet. Please wait.");
      }
      
      console.log(`Confirming unwrap for ${request.burnAmount} tokens...`);
      
      // Get ERC20 token for balance checking
      const erc20 = await ethers.getContractAt("TestCoin", request.erc20);
      const balanceBefore = await erc20.balanceOf(signer.address);
      
      // Confirm unwrap
      const confirmTx = await factory.connect(signer).confirmUnwarp();
      await confirmTx.wait();
      
      console.log(`Unwrap confirmed successfully!`);
      console.log(`Transaction hash: ${confirmTx.hash}`);
      
      // Check new balance
      const balanceAfter = await erc20.balanceOf(signer.address);
      const received = balanceAfter - balanceBefore;
      
      console.log(`ERC20 tokens received: ${ethers.formatEther(received)} tokens`);
      console.log(`New ERC20 balance: ${ethers.formatEther(balanceAfter)} tokens`);
      
    } catch (error) {
      console.error(`Error confirming unwrap: ${error}`);
    }
  });

/**
 * Check unwrap request status
 * Example: npx hardhat --network localhost task:check-unwrap-status --factory 0x123... --user 0
 */
task("task:check-unwrap-status", "Check the status of unwrap request")
  .addParam("factory", "The address of the ConfidentialTokenFactory contract")
  .addParam("user", "User index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    
    const signers = await ethers.getSigners();
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", taskArguments.factory);
    const userIndex = parseInt(taskArguments.user);
    const signer = signers[userIndex];
    
    try {
      const requestId = await factory.usersUnwrapRequests(signer.address);
      
      if (requestId === 0n) {
        console.log("No pending unwrap request found");
        return;
      }
      
      console.log(`Request ID: ${requestId}`);
      
      const request = await factory.unwrapRequestIds(requestId);
      console.log("=== Unwrap Request Status ===");
      console.log(`Owner: ${request.owner}`);
      console.log(`ERC20 Token: ${request.erc20}`);
      console.log(`Has Callback: ${request.hasCallback}`);
      console.log(`Burn Amount: ${request.burnAmount}`);
      
      if (request.hasCallback) {
        console.log(`✅ Ready to confirm unwrap for ${request.burnAmount} tokens`);
        console.log(`Run: npx hardhat --network localhost task:confirm-unwrap --factory ${taskArguments.factory} --user ${taskArguments.user}`);
      } else {
        console.log(`⏳ Waiting for decryption callback...`);
      }
      
    } catch (error) {
      console.error(`Error checking unwrap status: ${error}`);
    }
  });