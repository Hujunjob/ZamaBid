// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./ConfidentialTokenWrapper.sol";
import "hardhat/console.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FHE, externalEuint64, eaddress, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialTokenFactory
 * @notice Factory contract for deploying ConfidentialERC20 tokens
 */
contract ConfidentialTokenFactory is SepoliaConfig {
    event TokenCreated(address indexed tokenAddress, string name, string symbol);
    //erc20 token => confidentialToken
    mapping(address => address) public confidentialTokens;

    //confidentialToken => erc20 token
    mapping(address => address) public normalTokens;

    uint8 confidentialTokenDecimals = 6;

    /**
     * @notice Create a new ConfidentialERC20 token
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @return tokenAddress Address of the newly created token
     */
    function createToken(
        address erc20_,
        string memory name_,
        string memory symbol_
    ) internal returns (address tokenAddress) {
        //         IERC20 underlyingToken,
        // string memory name_,
        // string memory symbol_,
        // string memory tokenURI_
        ConfidentialTokenWrapper token = new ConfidentialTokenWrapper(IERC20(erc20_), name_, symbol_, "");
        tokenAddress = address(token);
        emit TokenCreated(tokenAddress, name_, symbol_);
        ERC20 erc20 = ERC20(erc20_);
        erc20.approve(tokenAddress, type(uint256).max);
        return tokenAddress;
    }

    function getERC20(address confidentialToken_) external view returns (address) {
        return normalTokens[confidentialToken_];
    }

    function getConfidentialToken(address normalToken_) external view returns (address) {
        return confidentialTokens[normalToken_];
    }

    function wrapERC20(address erc20_, uint256 amount) external returns (address) {
        address cftokenAddress = confidentialTokens[erc20_];
        ERC20 erc20Token = ERC20(erc20_);
        require(amount >= 10 ** (erc20Token.decimals() - confidentialTokenDecimals), "Below 1 token");
        require(
            amount / (10 ** (erc20Token.decimals() - confidentialTokenDecimals)) < type(uint64).max,
            "Amount too large"
        );
        if (cftokenAddress == address(0)) {
            cftokenAddress = createToken(erc20_, erc20Token.name(), erc20Token.symbol());
            confidentialTokens[erc20_] = cftokenAddress;
            normalTokens[cftokenAddress] = erc20_;
        }
        console.log("wrapERC20 1:", amount);
        erc20Token.transferFrom(msg.sender, address(this), amount);
        console.log("wrapERC20 2");
        ConfidentialTokenWrapper token = ConfidentialTokenWrapper(cftokenAddress);
        token.wrap(msg.sender, amount);
        console.log("wrapERC20 3");
        return cftokenAddress;
    }
}
