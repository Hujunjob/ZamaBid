// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./ConfidentialERC20.sol";
import "hardhat/console.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FHE, externalEuint64, eaddress, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialToken
 * @notice A concrete implementation of ConfidentialERC20 that can be deployed with custom name and symbol
 */
contract ConfidentialToken is ConfidentialERC20 {
    address public owner;

    constructor(string memory name_, string memory symbol_, address owner_) ConfidentialERC20(name_, symbol_) {
        owner = owner_;
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
        _unsafeMint(to, amount);
    }

    function burn(address from, uint64 amount) external {
        require(msg.sender == owner, "Only owner can burn");
        _unsafeBurn(from, amount);
    }
}

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

    struct UnwarpRequest {
        uint256 requestId;
        bool hasCallback;
        uint64 burnAmount;
        address owner;
        address erc20;
    }

    mapping(address => uint256) private usersUnwrapRequests;
    mapping(uint256 => UnwarpRequest) private unwrapRequestIds;

    /**
     * @notice Create a new ConfidentialERC20 token
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @return tokenAddress Address of the newly created token
     */
    function createToken(string memory name_, string memory symbol_) internal returns (address tokenAddress) {
        ConfidentialToken token = new ConfidentialToken(name_, symbol_, address(this));
        tokenAddress = address(token);
        emit TokenCreated(tokenAddress, name_, symbol_);

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
            cftokenAddress = createToken(erc20Token.name(), erc20Token.symbol());
            confidentialTokens[erc20_] = cftokenAddress;
            normalTokens[cftokenAddress] = erc20_;
        }
        uint64 mintAmount = uint64(amount / 10 ** 18);
        // require(amount / 10 ** 18 <= type(uint64).max, "Amount too large for uint64");
        erc20Token.transferFrom(msg.sender, address(this), amount);
        ConfidentialToken cfToken = ConfidentialToken(cftokenAddress);
        cfToken.mint(msg.sender, mintAmount);
        return cftokenAddress;
    }

    function unwarp(address confidentialToken_, uint64 amount) external returns (address) {
        require(amount > 0, "wrong amount");
        uint256 requestId = usersUnwrapRequests[msg.sender];
        require(requestId == 0, "has old request");

        address normalToken = normalTokens[confidentialToken_];
        require(normalToken != address(0), "Wrong token");
        //send ConfidentialToken to
        ConfidentialToken cfToken = ConfidentialToken(confidentialToken_);
        euint64 eBalance = cfToken.balanceOf(msg.sender);
        require(FHE.isAllowed(eBalance, msg.sender), "Now owner of this token");

        euint64 eAmount = FHE.asEuint64(amount);
        ebool elessBool = FHE.lt(eBalance, eAmount);
        //transfer amount
        euint64 transferAmount = FHE.select(elessBool, eAmount, eBalance);
        cfToken.transferFrom(msg.sender, address(this), transferAmount);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(transferAmount);
        uint256 latestRequestId = FHE.requestDecryption(cts, this.unwarpCallback.selector);
        UnwarpRequest memory request = UnwarpRequest({
            owner: msg.sender,
            erc20: normalToken,
            requestId: latestRequestId,
            hasCallback: false,
            burnAmount: 0
        });
        usersUnwrapRequests[msg.sender] = latestRequestId;
        unwrapRequestIds[latestRequestId] = request;
        return normalToken;
    }

    function unwarpCallback(uint256 requestId, uint64 decryptedInput, bytes[] memory signatures) public returns (bool) {
        /// @dev This check is used to verify that the request id is the expected one.
        UnwarpRequest storage request = unwrapRequestIds[requestId];
        require(request.requestId == requestId, "Invalid requestId");
        FHE.checkSignatures(requestId, signatures);
        request.hasCallback = true;
        request.burnAmount = decryptedInput;
        unwrapRequestIds[requestId] = request;

        return true;
    }

    function confirmUnwarp() external {
        uint256 requestId = usersUnwrapRequests[msg.sender];
        require(requestId != 0, "no request");
        UnwarpRequest memory request = unwrapRequestIds[requestId];
        require(request.hasCallback, "no callback");
        usersUnwrapRequests[msg.sender] = 0;
        address erc20Address = request.erc20;
        address confidentialTokenAddress = confidentialTokens[erc20Address];
        ConfidentialToken cfToken = ConfidentialToken(confidentialTokenAddress);
        uint64 burnAmount = request.burnAmount;
        delete unwrapRequestIds[requestId];
        if (burnAmount == 0) {
            return;
        }
        cfToken.burn(address(this), burnAmount);
        ERC20 erc20 = ERC20(erc20Address);
        erc20.transferFrom(address(this), msg.sender, burnAmount);
    }
}
