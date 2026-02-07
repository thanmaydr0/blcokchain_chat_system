# DuoGraph Smart Contracts

Solidity smart contracts for the DuoGraph decentralized chat system.

## Contracts

### BinaryPact.sol
The core contract implementing the Binary Pact Protocol:
- Creates pacts between exactly 2 users
- Stores encrypted metadata on IPFS
- Manages pact lifecycle (pending → active → dissolved)
- Registers public keys for encryption

## Development

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Install
```bash
forge install
```

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Deploy to Base Sepolia
```bash
# Set environment variables
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export PRIVATE_KEY=your_private_key

# Deploy
forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_SEPOLIA_RPC --broadcast
```

## Contract Addresses

| Contract | Base Sepolia |
|----------|--------------|
| BinaryPact | TBD |

## Getting Testnet ETH

Get Base Sepolia testnet ETH from:
- [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- [Alchemy Faucet](https://sepoliafaucet.com/)
