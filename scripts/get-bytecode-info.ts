import { ethers } from "ethers";

async function getBytecodeInfo() {
  const contractAddress = "0x7246fe641722617873360d9cf86ab85225c0eb08";
  
  // Connect to Sepolia using public RPC
  const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
  
  try {
    // Get the contract bytecode
    const bytecode = await provider.getCode(contractAddress);
    console.log("Contract bytecode length:", bytecode.length);
    console.log("First 100 chars:", bytecode.substring(0, 100));
    
    // Get the transaction that created this contract
    // This would require knowing the creation transaction hash
    // Let's try to get some basic info about the contract
    
    const confidentialTokenWrapper = new ethers.Contract(
      contractAddress,
      [
        "function underlying() view returns (address)",
        "function name() view returns (string)",
        "function symbol() view returns (string)"
      ],
      provider
    );
    
    console.log("Contract verified as working:");
    console.log("- Underlying token:", await confidentialTokenWrapper.underlying());
    console.log("- Name:", await confidentialTokenWrapper.name());
    console.log("- Symbol:", await confidentialTokenWrapper.symbol());
    
  } catch (error) {
    console.error("Error:", error);
  }
}

getBytecodeInfo().catch(console.error);