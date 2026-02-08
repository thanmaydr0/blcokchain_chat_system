# DuoGraph

A blockchain-anchored, decentralized two-person chat system with extreme privacy.

## 🔐 Features

- **End-to-End Encryption** - Signal Protocol Double Ratchet algorithm
- **Blockchain Anchored** - Binary Pact Protocol on Ethereum Sepolia
- **Hardware-Bound Identity** - Keys stored in browser's secure storage
- **WebRTC Calls** - Peer-to-peer audio/video calls
- **IPFS Media** - Decentralized encrypted file sharing
- **Zero Gas Fees** - ERC-4337 Account Abstraction support

## 📁 Project Structure

```
duograph/
├── frontend/          # Vite + React + TypeScript + TailwindCSS
├── contracts/         # Solidity smart contracts (Hardhat)
└── docs/              # API and deployment documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask wallet

### Frontend Setup

```bash
cd frontend
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Smart Contracts Setup

```bash
cd contracts
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your private key

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Sepolia
npm run deploy:sepolia
```

## 🔗 Smart Contracts

| Contract | Description |
|----------|-------------|
| `PactFactory.sol` | Factory for 2-person pacts with EIP-712 |
| `BinaryPact.sol` | Immutable 2-user pacts with session keys |
| `PaymasterContract.sol` | ERC-4337 gas sponsorship |
| `DuoGraphAccount.sol` | Smart account + factory |

### Security Guarantee

**3rd party exclusion is mathematically enforced:**
- `user1` and `user2` are `immutable` - set at deployment, never changeable
- No `addUser()` or similar function exists in any contract
- All pact functions have `onlyPactMember` modifier

## 📚 Documentation

- [API Documentation](docs/API.md) - Supabase schema, smart contract ABI, protocols
- [Deployment Guide](docs/DEPLOYMENT.md) - Setup and deployment instructions

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React, TypeScript, TailwindCSS |
| Backend | Supabase (encrypted metadata only) |
| Blockchain | Ethereum Sepolia, ERC-4337 |
| Encryption | Web Crypto API, Signal Protocol |
| Media | IPFS via Pinata |

## 📄 License

MIT
