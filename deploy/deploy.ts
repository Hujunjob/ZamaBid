import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHECounter = await deploy("FHECounter", {
    from: deployer,
    log: true,
  });

  console.log(`FHECounter contract: `, deployedFHECounter.address);

  const deployedConfidentialTokenFactory = await deploy("ConfidentialTokenFactory", {
    from: deployer,
    log: true,
  });

  console.log(`ConfidentialTokenFactory contract: `, deployedConfidentialTokenFactory.address);

  const deployedTestCoin = await deploy("TestCoin", {
    from: deployer,
    args: ["TestCoin", "TEST", ethers.parseEther("1000000")], // 1,000,000 tokens with 18 decimals
    log: true,
  });

  console.log(`TestCoin contract: `, deployedTestCoin.address);

};
export default func;
func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["FHECounter", "ConfidentialTokenFactory", "TestCoin"];
