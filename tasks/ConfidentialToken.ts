import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

/**
 * Example:
 *   - npx hardhat --network localhost task:get-token-info --token 0x123...
 *   - npx hardhat --network sepolia task:get-token-info --token 0x123...
 */
task("task:get-token", "Gets information about a ConfidentialERC20 token")
  .addParam("token", "The address of the ConfidentialERC20 token")
  .addParam("user", "The index of the user")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const tokenAddress = taskArguments.token;

    if (!tokenAddress) {
      throw new Error("--token parameter is required");
    }

    const tokenContract = await ethers.getContractAt("ConfidentialToken", tokenAddress);

    try {
      const name = await tokenContract.name();
      const symbol = await tokenContract.symbol();
      const owner = await tokenContract.owner();
    const signers = await ethers.getSigners();
    const userIndex = taskArguments.user;
    const ebalance = await tokenContract.balanceOf(owner)
    console.log(`Token balance: ${ebalance}`);


//  userDecryptEuint(
//     fhevmType: FhevmTypeEuint,
//     handleBytes32: string,
//     contractAddress: ethers.AddressLike,
//     user: ethers.Signer,
//     options?: FhevmUserDecryptOptions,
//   ): Promise<bigint>;

        // const clearCount = await fhevm.userDecryptEuint(
        //   FhevmType.euint32,
        //   ebalance,
        //   tokenAddress,
        //   signers[0],
        // );

      console.log(`Token Address: ${tokenAddress}`);
      console.log(`Token Name: ${name}`);
      console.log(`Token Symbol: ${symbol}`);
      console.log(`Token Owner: ${owner}`);
    } catch (err) {
      console.log(`Error getting token info: ${err}`);
    }


    
  });