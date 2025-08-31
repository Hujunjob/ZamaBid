// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Airdrop is ReentrancyGuard, Ownable {
    uint256 public constant CLAIM_AMOUNT = 100 * 10**18; // 100 tokens with 18 decimals
    uint256 public constant CLAIM_FEE = 0.001 ether; // 0.001 ETH fee
    
    event TokensClaimed(address indexed user, address indexed tokenAddress, uint256 amount);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    
    error InsufficientPayment();
    error TransferFailed();
    error InsufficientTokenBalance();
    
    constructor() Ownable(msg.sender) {}
    
    function claimTokens(address tokenAddress) external payable nonReentrant {
        // Check payment
        if (msg.value != CLAIM_FEE) {
            revert InsufficientPayment();
        }
        
        // Check if contract has enough tokens
        IERC20 token = IERC20(tokenAddress);
        if (token.balanceOf(address(this)) < CLAIM_AMOUNT) {
            revert InsufficientTokenBalance();
        }
        
        // Transfer tokens to user
        bool success = token.transfer(msg.sender, CLAIM_AMOUNT);
        if (!success) {
            revert TransferFailed();
        }
        
        emit TokensClaimed(msg.sender, tokenAddress, CLAIM_AMOUNT);
    }
    
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = payable(owner()).call{value: balance}("");
            if (!success) {
                revert TransferFailed();
            }
            emit FeesWithdrawn(owner(), balance);
        }
    }
    
    function getTokenBalance(address tokenAddress) external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }
    
    // Emergency function to recover stuck tokens
    function emergencyWithdraw(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        bool success = token.transfer(owner(), amount);
        if (!success) {
            revert TransferFailed();
        }
    }
    
    // Allow contract to receive ETH directly
    receive() external payable {}
    
    // Fallback function
    fallback() external payable {}
}