# DuoGraph Smart Contracts

Binary Pact Protocol - Blockchain-anchored two-person chat system with ERC-4337 Account Abstraction.

## Contracts

| Contract | Description |
|----------|-------------|
| `PactFactory.sol` | Factory for creating 2-person pacts |
| `BinaryPact.sol` | Individual pact with immutable users |
| `PaymasterContract.sol` | ERC-4337 gas sponsorship |
| `DuoGraphAccount.sol` | Smart account for users |

## Security Guarantee

**3rd party exclusion is mathematically enforced:**
- `user1` and `user2` are `immutable` - set at deployment, never changeable
- No `addUser()` or similar function exists in any contract
- All pact functions have `onlyPactMember` modifier

## Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Sepolia
npm run deploy:sepolia
```

## Environment Setup

```bash
cp .env.example .env
# Edit .env with your private key and API keys
```

## Contract Addresses (Sepolia)

After deployment, addresses are saved to `deployments.json`.

## Testing

```bash
# Run all tests
npm test

# With gas reporting
REPORT_GAS=true npm test

# Coverage
npm run test:coverage
```

## Deployment

```bash
# Local (Hardhat network)
npm run deploy:local

# Ethereum Sepolia Testnet
npm run deploy:sepolia
```

Get testnet ETH from:
- [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- [Infura Faucet](https://www.infura.io/faucet/sepolia)
