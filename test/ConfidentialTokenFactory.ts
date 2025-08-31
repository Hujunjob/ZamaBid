import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialTokenFactory, ConfidentialTokenWrapper, TestCoin, ConfidentialTokenFactory__factory, ConfidentialTokenWrapper__factory, TestCoin__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factoryFactory = (await ethers.getContractFactory("ConfidentialTokenFactory")) as ConfidentialTokenFactory__factory;
  const tokenFactory = (await factoryFactory.deploy()) as ConfidentialTokenFactory;
  const tokenFactoryAddress = await tokenFactory.getAddress();

  const testCoinFactory = (await ethers.getContractFactory("TestCoin")) as TestCoin__factory;
  const initialSupply = ethers.parseEther("1000000"); // 1M tokens for testing
  const testCoin = (await testCoinFactory.deploy("TestCoin", "TEST", initialSupply)) as TestCoin;
  const testCoinAddress = await testCoin.getAddress();

  return { tokenFactory, tokenFactoryAddress, testCoin, testCoinAddress };
}

describe("ConfidentialTokenFactory", function () {
  let signers: Signers;
  let tokenFactory: ConfidentialTokenFactory;
  let tokenFactoryAddress: string;
  let testCoin: TestCoin;
  let testCoinAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ tokenFactory, tokenFactoryAddress, testCoin, testCoinAddress } = await deployFixture());
  });

  describe("wrapERC20", function () {
    it("should create a new confidential token for first-time ERC20", async function () {
      const amount = ethers.parseEther("5");
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      const tx = await tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount);
      const receipt = await tx.wait();

      const tokenCreatedEvent = receipt?.logs.find(
        log => log.topics[0] === tokenFactory.interface.getEvent("TokenCreated")?.topicHash
      );
      expect(tokenCreatedEvent).to.not.be.undefined;

      const confidentialTokenAddress = await tokenFactory.confidentialTokens(testCoinAddress);
      expect(confidentialTokenAddress).to.not.equal(ethers.ZeroAddress);

      const confidentialToken = ConfidentialTokenWrapper__factory.connect(confidentialTokenAddress, signers.alice);
      expect(await confidentialToken.name()).to.equal(await testCoin.name());
      expect(await confidentialToken.symbol()).to.equal(await testCoin.symbol());
    });

    it("should reuse existing confidential token for subsequent wraps", async function () {
      const amount = ethers.parseEther("5");
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);
      
      const firstWrapTx = await tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount);
      await firstWrapTx.wait();
      
      const firstConfidentialTokenAddress = await tokenFactory.confidentialTokens(testCoinAddress);

      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);
      
      const secondWrapTx = await tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount);
      await secondWrapTx.wait();
      
      const secondConfidentialTokenAddress = await tokenFactory.confidentialTokens(testCoinAddress);
      
      expect(firstConfidentialTokenAddress).to.equal(secondConfidentialTokenAddress);
    });

    it("should transfer ERC20 tokens to factory", async function () {
      const amount = ethers.parseEther("5");
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      const aliceBalanceBefore = await testCoin.balanceOf(signers.alice.address);
      const factoryBalanceBefore = await testCoin.balanceOf(tokenFactoryAddress);

      await tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount);

      const aliceBalanceAfter = await testCoin.balanceOf(signers.alice.address);
      const factoryBalanceAfter = await testCoin.balanceOf(tokenFactoryAddress);

      expect(aliceBalanceAfter).to.equal(aliceBalanceBefore - amount);
      expect(factoryBalanceAfter).to.equal(factoryBalanceBefore + amount);
    });

    it("should mint correct amount of confidential tokens", async function () {
      const amount = ethers.parseEther("5");
      const expectedMintAmount = 5n; // 5 * 10^18 / 10^18 = 5
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      await tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount);

      const confidentialTokenAddress = await tokenFactory.confidentialTokens(testCoinAddress);
      const confidentialToken = ConfidentialTokenWrapper__factory.connect(confidentialTokenAddress, signers.alice);
      
      expect(await confidentialToken.totalSupply()).to.equal(expectedMintAmount);
    });

    it("should revert if amount is below 1 token", async function () {
      const amount = ethers.parseEther("0.5"); // 0.5 ETH
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      await expect(
        tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount)
      ).to.be.revertedWith("Below 1 token");
    });

    it("should revert if amount is too large for uint64", async function () {
      const amount = ethers.parseEther("1"); // Use a normal amount for testing
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      // Mock the contract to simulate the large amount check by testing with a very large number directly
      // We'll just test that the function properly validates the input
      const maxUint64Plus1 = (2n ** 64n) * (10n ** 18n);
      
      await expect(
        tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, maxUint64Plus1)
      ).to.be.revertedWith("Amount too large");
    });

    it("should revert if insufficient allowance", async function () {
      const amount = ethers.parseEther("5");
      const insufficientAllowance = ethers.parseEther("2");
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, insufficientAllowance);

      await expect(
        tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount)
      ).to.be.reverted;
    });

    it("should revert if insufficient balance", async function () {
      const amount = ethers.parseEther("5");
      const insufficientBalance = ethers.parseEther("2");
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, insufficientBalance);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      await expect(
        tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount)
      ).to.be.reverted;
    });
  });

  describe("confidentialTokens mapping", function () {
    it("should return zero address for non-existing tokens", async function () {
      const nonExistentToken = ethers.Wallet.createRandom().address;
      const confidentialTokenAddress = await tokenFactory.confidentialTokens(nonExistentToken);
      expect(confidentialTokenAddress).to.equal(ethers.ZeroAddress);
    });

    it("should return correct confidential token address after wrapping", async function () {
      const amount = ethers.parseEther("5");
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      await tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount);

      const confidentialTokenAddress = await tokenFactory.confidentialTokens(testCoinAddress);
      expect(confidentialTokenAddress).to.not.equal(ethers.ZeroAddress);
      
      const confidentialToken = ConfidentialTokenWrapper__factory.connect(confidentialTokenAddress, signers.alice);
      expect(await confidentialToken.owner()).to.equal(tokenFactoryAddress);
    });
  });

  describe("Events", function () {
    it("should emit TokenCreated event when creating new confidential token", async function () {
      const amount = ethers.parseEther("5");
      
      await testCoin.connect(signers.deployer).transfer(signers.alice.address, amount);
      await testCoin.connect(signers.alice).approve(tokenFactoryAddress, amount);

      const tx = await tokenFactory.connect(signers.alice).wrapERC20(testCoinAddress, amount);
      await tx.wait();
      
      const confidentialTokenAddress = await tokenFactory.confidentialTokens(testCoinAddress);
      
      await expect(tx)
        .to.emit(tokenFactory, "TokenCreated")
        .withArgs(
          confidentialTokenAddress,
          await testCoin.name(),
          await testCoin.symbol(),
          0
        );
    });
  });
});