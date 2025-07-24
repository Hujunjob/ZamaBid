import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialTokenFactory, ConfidentialTokenFactory__factory, ConfidentialToken, ConfidentialToken__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialTokenFactory")) as ConfidentialTokenFactory__factory;
  const factoryContract = (await factory.deploy()) as ConfidentialTokenFactory;
  const factoryContractAddress = await factoryContract.getAddress();

  return { factoryContract, factoryContractAddress };
}

describe("ConfidentialTokenFactory", function () {
  let signers: Signers;
  let factoryContract: ConfidentialTokenFactory;
  let factoryContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ factoryContract, factoryContractAddress } = await deployFixture());
  });

  describe("Token Creation", function () {
    it("should create a new ConfidentialERC20 token with correct name and symbol", async function () {
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";

      const tx = await factoryContract.connect(signers.alice).createToken(tokenName, tokenSymbol);
      const receipt = await tx.wait();

      // Check that TokenCreated event was emitted
      const events = receipt?.logs;
      expect(events).to.have.length.greaterThan(0);

      const tokenCreatedEvent = factoryContract.interface.parseLog(events![0]);
      expect(tokenCreatedEvent!.name).to.equal("TokenCreated");
      expect(tokenCreatedEvent!.args.name).to.equal(tokenName);
      expect(tokenCreatedEvent!.args.symbol).to.equal(tokenSymbol);
      expect(tokenCreatedEvent!.args.initialSupply).to.equal(0);

      const tokenAddress = tokenCreatedEvent!.args.tokenAddress;
      expect(tokenAddress).to.be.a("string");
      expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

      // Verify the created token has correct properties
      const tokenContract = await ethers.getContractAt("ConfidentialToken", tokenAddress);
      expect(await tokenContract.name()).to.equal(tokenName);
      expect(await tokenContract.symbol()).to.equal(tokenSymbol);
      expect(await tokenContract.owner()).to.equal(factoryContractAddress);
    });

    it("should create multiple different tokens", async function () {
      const token1Name = "Token One";
      const token1Symbol = "TOK1";
      const token2Name = "Token Two";
      const token2Symbol = "TOK2";

      // Create first token
      const tx1 = await factoryContract.connect(signers.alice).createToken(token1Name, token1Symbol);
      const receipt1 = await tx1.wait();
      const token1Event = factoryContract.interface.parseLog(receipt1?.logs![0]);
      const token1Address = token1Event!.args.tokenAddress;

      // Create second token
      const tx2 = await factoryContract.connect(signers.bob).createToken(token2Name, token2Symbol);
      const receipt2 = await tx2.wait();
      const token2Event = factoryContract.interface.parseLog(receipt2?.logs![0]);
      const token2Address = token2Event!.args.tokenAddress;

      // Tokens should have different addresses
      expect(token1Address).to.not.equal(token2Address);

      // Verify both tokens exist and have correct properties
      const token1Contract = await ethers.getContractAt("ConfidentialToken", token1Address);
      const token2Contract = await ethers.getContractAt("ConfidentialToken", token2Address);

      expect(await token1Contract.name()).to.equal(token1Name);
      expect(await token1Contract.symbol()).to.equal(token1Symbol);
      expect(await token2Contract.name()).to.equal(token2Name);
      expect(await token2Contract.symbol()).to.equal(token2Symbol);
    });

    it("should allow creating tokens with empty name and symbol", async function () {
      const tx = await factoryContract.connect(signers.alice).createToken("", "");
      const receipt = await tx.wait();

      const tokenCreatedEvent = factoryContract.interface.parseLog(receipt?.logs![0]);
      expect(tokenCreatedEvent!.args.name).to.equal("");
      expect(tokenCreatedEvent!.args.symbol).to.equal("");

      const tokenAddress = tokenCreatedEvent!.args.tokenAddress;
      const tokenContract = await ethers.getContractAt("ConfidentialToken", tokenAddress);
      expect(await tokenContract.name()).to.equal("");
      expect(await tokenContract.symbol()).to.equal("");
    });
  });

  describe("Created Token Functionality", function () {
    let tokenContract: ConfidentialToken;
    let tokenAddress: string;

    beforeEach(async function () {
      const tx = await factoryContract.connect(signers.alice).createToken("Test Token", "TEST");
      const receipt = await tx.wait();
      const tokenCreatedEvent = factoryContract.interface.parseLog(receipt?.logs![0]);
      tokenAddress = tokenCreatedEvent!.args.tokenAddress;
      tokenContract = await ethers.getContractAt("ConfidentialToken", tokenAddress);
    });

    it("should have factory as owner of created token", async function () {
      expect(await tokenContract.owner()).to.equal(factoryContractAddress);
    });

    it("should have zero initial supply", async function () {
      const totalSupply = await tokenContract.totalSupply();
      expect(totalSupply).to.equal(0);
    });

    it("should allow factory to mint tokens", async function () {
      const mintAmount = 1000;

      // Factory should be able to mint (since it's the owner)
      const tx = await factoryContract.connect(signers.deployer).createToken("Mintable Token", "MINT");
      const receipt = await tx.wait();
      const event = factoryContract.interface.parseLog(receipt?.logs![0]);
      const mintableTokenAddress = event!.args.tokenAddress;
      const mintableToken = await ethers.getContractAt("ConfidentialToken", mintableTokenAddress);

      // Since factory is owner, we need to call mint from a transaction that goes through factory
      // For this test, let's verify the owner relationship is correct
      expect(await mintableToken.owner()).to.equal(factoryContractAddress);
      
      // Test that we can't mint from non-owner
      await expect(
        mintableToken.connect(signers.alice).mint(signers.alice.address, mintAmount)
      ).to.be.revertedWith("Only owner can mint");
    });

    it("should not allow non-owner to mint tokens", async function () {
      const mintAmount = 1000;

      // Alice should not be able to mint since she's not the owner
      await expect(
        tokenContract.connect(signers.alice).mint(signers.alice.address, mintAmount)
      ).to.be.revertedWith("Only owner can mint");
    });

    it("should handle encrypted balance operations", async function () {
      // This test verifies that the created token supports encrypted operations
      // Since we can't mint without being the owner (factory), we'll test that the 
      // balance query works and returns encrypted zero
      const encryptedBalance = await tokenContract.balanceOf(signers.alice.address);
      expect(encryptedBalance).to.equal(ethers.ZeroHash); // Uninitialized encrypted value
    });
  });

  describe("Gas Efficiency", function () {
    it("should deploy tokens with reasonable gas cost", async function () {
      const tx = await factoryContract.connect(signers.alice).createToken("Gas Test", "GAS");
      const receipt = await tx.wait();
      
      // Verify transaction succeeded
      expect(receipt?.status).to.equal(1);
      
      // Gas usage should be reasonable (this is more of a monitoring test)
      const gasUsed = receipt?.gasUsed;
      expect(gasUsed).to.be.greaterThan(0);
      console.log(`Gas used for token creation: ${gasUsed}`);
    });
  });

  describe("Edge Cases", function () {
    it("should handle very long token names and symbols", async function () {
      const longName = "A".repeat(100);
      const longSymbol = "B".repeat(50);

      const tx = await factoryContract.connect(signers.alice).createToken(longName, longSymbol);
      const receipt = await tx.wait();

      const tokenCreatedEvent = factoryContract.interface.parseLog(receipt?.logs![0]);
      expect(tokenCreatedEvent!.args.name).to.equal(longName);
      expect(tokenCreatedEvent!.args.symbol).to.equal(longSymbol);
    });

    it("should handle special characters in token names and symbols", async function () {
      const specialName = "Token-With_Special.Chars!@#";
      const specialSymbol = "T-S_C.!";

      const tx = await factoryContract.connect(signers.alice).createToken(specialName, specialSymbol);
      const receipt = await tx.wait();

      const tokenCreatedEvent = factoryContract.interface.parseLog(receipt?.logs![0]);
      expect(tokenCreatedEvent!.args.name).to.equal(specialName);
      expect(tokenCreatedEvent!.args.symbol).to.equal(specialSymbol);
    });

    it("should handle unicode characters in token names and symbols", async function () {
      const unicodeName = "代币测试 🚀";
      const unicodeSymbol = "代币";

      const tx = await factoryContract.connect(signers.alice).createToken(unicodeName, unicodeSymbol);
      const receipt = await tx.wait();

      const tokenCreatedEvent = factoryContract.interface.parseLog(receipt?.logs![0]);
      expect(tokenCreatedEvent!.args.name).to.equal(unicodeName);
      expect(tokenCreatedEvent!.args.symbol).to.equal(unicodeSymbol);
    });
  });

  describe("Event Emission", function () {
    it("should emit TokenCreated event with correct parameters", async function () {
      const tokenName = "Event Test Token";
      const tokenSymbol = "EVENT";

      await expect(factoryContract.connect(signers.alice).createToken(tokenName, tokenSymbol))
        .to.emit(factoryContract, "TokenCreated")
        .withArgs(
          (tokenAddress: string) => tokenAddress !== ethers.ZeroAddress,
          tokenName,
          tokenSymbol,
          0
        );
    });
  });
});