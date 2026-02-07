# DuoGraph

A blockchain-anchored, decentralized two-person chat system with extreme privacy.

## Features

- 🔐 **End-to-End Encryption** - Signal Protocol Double Ratchet algorithm
- 🔗 **Blockchain Anchored** - Binary Pact Protocol on Base Sepolia
- 🔑 **Hardware-Bound Identity** - Keys stored in browser's secure storage
- 📞 **WebRTC Calls** - Peer-to-peer audio/video calls
- 📁 **IPFS Media** - Decentralized encrypted file sharing
- ⛽ **Zero Gas Fees** - ERC-4337 Account Abstraction support

## Tech Stack

- **Frontend**: Vite + React + TypeScript + TailwindCSS
- **Backend**: Supabase (encrypted metadata only)
- **Blockchain**: Base Sepolia (ERC-4337)
- **Encryption**: Web Crypto API + Signal Protocol
- **Media**: IPFS via Pinata

## Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd duograph

# Install frontend dependencies
cd frontend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

## Project Structure

```
duograph/
├── frontend/           # Vite + React application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom hooks
│   │   ├── lib/        # Utilities (crypto, web3, etc.)
│   │   ├── pages/      # Page components
│   │   ├── store/      # Zustand state management
│   │   └── types/      # TypeScript definitions
│   └── ...
├── contracts/          # Solidity smart contracts
│   ├── src/
│   │   └── BinaryPact.sol
│   └── ...
└── docs/              # Documentation
    ├── API.md
    └── DEPLOYMENT.md
```

## Documentation

- [API Documentation](docs/API.md) - Supabase schema, smart contract ABI, protocols
- [Deployment Guide](docs/DEPLOYMENT.md) - Setup and deployment instructions

## Binary Pact Protocol

The core innovation of DuoGraph is the Binary Pact Protocol:

1. **Create Pact**: User A invites User B to form a pact
2. **Accept Pact**: User B accepts, activating the encrypted channel
3. **Communicate**: Only these 2 users can ever participate
4. **Dissolve**: Either user can end the pact

This creates an immutable record of the two-party relationship on-chain while keeping all communication encrypted and off-chain.

## Security

- All messages encrypted client-side before transmission
- Keys never leave the user's device
- Supabase stores only encrypted metadata
- Blockchain provides identity verification, not message storage

## License

MIT
