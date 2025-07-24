// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./ConfidentialERC20.sol";
import "hardhat/console.sol";

/**
 * @title ConfidentialToken
 * @notice A concrete implementation of ConfidentialERC20 that can be deployed with custom name and symbol
 */
contract ConfidentialToken is ConfidentialERC20 {
    address public owner;

    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        uint64 initialSupply
    ) ConfidentialERC20(name_, symbol_) {
        owner = owner_;
        if (initialSupply > 0) {
            _totalSupply = initialSupply;
            console.log("ConfidentialToken constructro:", _totalSupply);
            _unsafeMintNoEvent(owner_, initialSupply);
        }
    }

    /**
     * @notice Mint new tokens (only owner can mint)
     * @param to Address to mint tokens to
     * @param amount Amount to mint
     */
    function mint(address to, uint64 amount) external {
        require(msg.sender == owner, "Only owner can mint");
        require(_totalSupply + amount >= _totalSupply, "Overflow");

        _totalSupply += amount;
        _unsafeMint(to, amount);
    }
}

/**
 * @title ConfidentialTokenFactory
 * @notice Factory contract for deploying ConfidentialERC20 tokens
 */
contract ConfidentialTokenFactory {
    event TokenCreated(address indexed tokenAddress, string name, string symbol, uint64 initialSupply);

    /**
     * @notice Create a new ConfidentialERC20 token
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param initialSupply_ InitialSupply_ of the token
     * @return tokenAddress Address of the newly created token
     */
    function createToken(
        string memory name_,
        string memory symbol_,
        uint64 initialSupply_
    ) external returns (address tokenAddress) {
        ConfidentialToken token = new ConfidentialToken(name_, symbol_, address(this), initialSupply_);

        tokenAddress = address(token);
        emit TokenCreated(tokenAddress, name_, symbol_, initialSupply_);

        return tokenAddress;
    }
}
