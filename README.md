# PopCoin NFT Minting DApp

A full-stack Web3 application consisting of a React/Vite frontend and a Foundry-managed Solidity contract layer. The interface connects to the live `PopCoinNFTCollection` ERC-721 contract deployed on Arbitrum One mainnet, exposing mint operations with real-time on-chain state feedback.

## Context

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Ethers.js v6 |
| Smart Contract | Solidity 0.8.26, OpenZeppelin ERC-721 |
| Dev Toolchain | Foundry (`forge`, `anvil`, `cast`) |
| Networks | Arbitrum One (mainnet) · Arbitrum Sepolia (testnet) |
| Contract Address | [`0xd068673a424a8d90e9c34ccce03c1854547ddb7f`](https://arbiscan.io/address/0xd068673a424a8d90e9c34ccce03c1854547ddb7f) |

## Repository Structure

```
.
├── contracts/                  # Solidity source files
│   └── PopCoinNFTCollection.sol
├── test-solidity/              # Foundry test suite
│   └── PopCoinNFTCollectionTest.t.sol
├── script/                     # Foundry deployment scripts
│   └── DeployPopCoin.s.sol
├── src/                        # React frontend
│   ├── App.jsx
│   └── index.css
├── lib/                        # Foundry dependencies (forge install)
├── foundry.toml
├── package.json
└── vite.config.js
```

## Smart Contract

`PopCoinNFTCollection` is a capped ERC-721 collection with a permissionless `mint()` function. Key properties:

- **Supply cap**: `totalSupply` set at deployment (immutable)
- **Token IDs**: sequential, starting at `0`, tracked via `currentTokenId`
- **Metadata**: base URI concatenation (`baseUri + tokenId + ".json"`)
- **Custom errors**: `SoldOut()` to save gas vs. string reverts
- **No owner privileges**: permissionless public mint

### ABI Summary

| Function | Mutability | Description |
|----------|-----------|-------------|
| `mint()` | `external` | Mints the next token ID to `msg.sender` |
| `balanceOf(address)` | `view` | Returns token count for an address |
| `currentTokenId()` | `view` | Returns the next token ID to be minted |
| `totalSupply()` | `view` | Returns the hard cap on mintable tokens |
| `tokenURI(uint256)` | `view` | Returns fully qualified metadata URI |

## Frontend

The React interface:

1. Detects MetaMask (EIP-1193 `window.ethereum`)
2. Reads on-chain state in parallel (`Promise.all`) via `ethers.BrowserProvider`
3. Estimates gas cost before confirming the mint transaction
4. Provides a step-by-step transaction status tracker during broadcast and confirmation
5. Supports dynamic network switching between Arbitrum One and Arbitrum Sepolia via `wallet_switchEthereumChain` / `wallet_addEthereumChain`

## Local Development

### Prerequisites

- Node.js ≥ 18
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- MetaMask browser extension

### Frontend

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Smart Contract Tests

```bash
forge build
forge test -vv
forge coverage
```

### Deploy (Testnet)

1. Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

2. Set the required values in `.env`:

```env
PRIVATE_KEY=<your_wallet_private_key>
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBISCAN_API_KEY=<your_arbiscan_api_key>
```

3. Run the deployment script:

```bash
forge script script/DeployPopCoin.s.sol:DeployPopCoin \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY \
  -vvvv
```

4. Update `DEFAULT_SEPOLIA_ADDRESS` in `src/App.jsx` with the deployed address.

### Obtaining Test ETH (Arbitrum Sepolia)

Use the [QuickNode Arbitrum Sepolia faucet](https://faucet.quicknode.com/drip-pools/arbitrum-sepolia) or the [Alchemy faucet](https://www.alchemy.com/faucets/arbitrum-sepolia) to fund a testnet wallet before minting.

## Test Coverage

| Contract | Lines | Branches |
|----------|-------|----------|
| `PopCoinNFTCollection` | 100% | 100% |

Run `forge coverage` to generate the report locally.

## Security Notes

- `mint()` follows Checks-Effects-Interactions: the supply check precedes all state mutations
- No access control on `mint()` is intentional — this is a permissionless collection
- The frontend never stores private keys; all signing is delegated to MetaMask
