# 部署指南 / Deployment Guide

## 环境配置 / Environment Setup

### 1. 配置环境变量 / Configure Environment Variables

复制 `.env.example` 文件为 `.env`：
```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填入以下实际值：

```env
# 私钥 - 用于部署合约 (推荐使用)
# 从MetaMask导出私钥：账户详情 -> 导出私钥
# ⚠️ 请确保这是测试账户，不要使用包含真实资金的账户
PRIVATE_KEY="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

# 助记词 - 备用方式 (不推荐，仅用于测试)
# 可以使用MetaMask或其他钱包导出的助记词
MNEMONIC="your twelve word mnemonic phrase here"

# Infura API Key - 用于连接Sepolia网络
# 从 https://infura.io/ 获取免费API密钥
INFURA_API_KEY="your_infura_api_key_here"

# Etherscan API Key - 用于合约验证（可选）
# 从 https://etherscan.io/apis 获取免费API密钥
ETHERSCAN_API_KEY="your_etherscan_api_key_here"
```

### 📝 如何获取私钥 / How to Get Private Key

**从MetaMask导出私钥：**
1. 打开MetaMask扩展
2. 点击账户名旁边的三个点
3. 选择"账户详情"
4. 点击"导出私钥"
5. 输入MetaMask密码
6. 复制显示的私钥（以0x开头的64位十六进制字符串）

⚠️ **安全提醒**: 请确保使用的是专门用于测试的账户，不要使用包含真实资金的主账户！

### 2. 获取测试ETH / Get Test ETH

确保你的钱包地址在Sepolia测试网有足够的ETH用于部署：
- 访问 [Sepolia Faucet](https://sepoliafaucet.com/) 获取测试ETH
- 或者使用 [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)

## 部署步骤 / Deployment Steps

### 1. 编译合约 / Compile Contracts
```bash
npx hardhat compile
```

### 2. 部署到Sepolia / Deploy to Sepolia
```bash
npx hardhat deploy --network sepolia
```

### 3. 验证部署 / Verify Deployment
部署成功后，会显示合约地址：
```
ConfidentialTokenFactory contract: 0x...
TestCoin contract: 0x...
```

### 4. 验证合约代码（可选）/ Verify Contract Code (Optional)
如果配置了ETHERSCAN_API_KEY，可以验证合约：
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## 部署的合约 / Deployed Contracts

1. **ConfidentialTokenFactory**: 用于创建加密代币的工厂合约
2. **TestCoin**: 测试用的ERC20代币，初始供应量为1,000,000个

## 测试部署 / Test Deployment

可以使用Hardhat任务来测试已部署的合约：
```bash
npx hardhat test --network sepolia
```

## 注意事项 / Important Notes

- ⚠️ 永远不要将包含真实资金的助记词提交到版本控制
- ⚠️ .env文件已被.gitignore忽略，不会被提交
- 💡 Sepolia是测试网，所有ETH都是测试币，没有实际价值
- 💡 部署需要一定的gas费用，确保钱包有足够的测试ETH

## 故障排除 / Troubleshooting

### "Invalid JSON-RPC response received: invalid project id"
- 检查INFURA_API_KEY是否正确设置
- 确认API密钥有效且未过期

### "project ID does not have access to this network"
- 登录Infura Dashboard
- 确认你的项目已启用Sepolia Testnet
- 在项目设置中添加Sepolia网络支持

### "insufficient funds for intrinsic transaction cost"
- 钱包余额不足，需要从水龙头获取更多测试ETH

### "nonce too high"
- 重置MetaMask账户的nonce或等待一段时间后重试

### Contracts
- ConfidentialTokenFactory contract:  0x8d3F4e8fe379dBEA133420Eb6Be79033A0e78593
- ZamaForge contract : 0xdc5A3601541518A3B52879ef5F231f6A624C93EB
- Airdrop contract: 0x6dB435EFe22787b6CC4E0DDAb8a6281a8a6E04F1