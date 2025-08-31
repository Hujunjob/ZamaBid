import { ethers } from "ethers";

async function getConstructorArgs() {
  const contractAddress = "0x7246fe641722617873360d9cf86ab85225c0eb08";
  
  // Connect to Sepolia using public RPC
  const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
  
  try {
    // Get the contract creation transaction
    const contract = await provider.getCode(contractAddress);
    if (contract === "0x") {
      console.log("Contract not found at this address");
      return;
    }
    
    console.log("Contract found at address:", contractAddress);
    
    // Create contract instance to get underlying token
    const confidentialTokenWrapper = new ethers.Contract(
      contractAddress,
      [
        "function underlying() view returns (address)",
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function tokenURI() view returns (string)"
      ],
      provider
    );
    
    const underlyingToken = await confidentialTokenWrapper.underlying();
    const name = await confidentialTokenWrapper.name();
    const symbol = await confidentialTokenWrapper.symbol();
    
    console.log("Constructor arguments:");
    console.log("- underlyingToken:", underlyingToken);
    console.log("- name:", name);
    console.log("- symbol:", symbol);
    console.log("- tokenURI: (empty string)");
    
    return {
      underlyingToken,
      name,
      symbol,
      tokenURI: ""
    };
    
  } catch (error) {
    console.error("Error getting constructor arguments:", error);
  }
}

getConstructorArgs().catch(console.error);