// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./ConfidentialERC20.sol";
import "hardhat/console.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

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
        require(amount > 0, "Amount must be positive");
        require(_totalSupply <= type(uint64).max - amount, "Total supply overflow");

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
    //erc20 token => confidentialToken
    mapping(address => address) public confidentialTokens;

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
    ) internal returns (address tokenAddress) {
        ConfidentialToken token = new ConfidentialToken(name_, symbol_, address(this), initialSupply_);
        tokenAddress = address(token);
        emit TokenCreated(tokenAddress, name_, symbol_, initialSupply_);

        return tokenAddress;
    }

    function wrapERC20(address erc20_, uint256 amount) external returns (address tokenAddress) {
        address cftokenAddress = confidentialTokens[erc20_];
        ERC20 erc20Token = ERC20(erc20_);
        require(amount >= 10 ** 18, "Below 1 token");
        require(amount / (10 ** 18) < type(uint64).max, "Amount too large");
        if (cftokenAddress == address(0)) {
            cftokenAddress = createToken(erc20Token.name(), erc20Token.symbol(), 0);
            confidentialTokens[erc20_] = cftokenAddress;
        }
        uint64 mintAmount = uint64(amount / 10 ** 18);
        require(amount / 10 ** 18 <= type(uint64).max, "Amount too large for uint64");
        erc20Token.transferFrom(msg.sender, address(this), amount);
        ConfidentialToken cfToken = ConfidentialToken(cftokenAddress);
        cfToken.mint(msg.sender, mintAmount);
        return cftokenAddress;
    }

    function unwarp(address erc20_, uint256 amount) external {}
}
