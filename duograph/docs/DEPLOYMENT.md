# DuoGraph Deployment Guide

## Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn
- MetaMask or similar Web3 wallet
- Supabase account
- Pinata account (for IPFS)
- Render account (for hosting)

## Environment Setup

### 1. Supabase Setup

1. Create a new project at [Supabase](https://supabase.com)
2. Get your project URL and anon key from Settings → API
3. Create the required tables (see `docs/API.md`)

### 2. Smart Contracts

```bash
cd contracts
cp .env.example .env
# Edit .env with your private key
```

### 3. Ethereum Sepolia Setup

1. Add Sepolia to MetaMask:
   - Network Name: Sepolia
   - RPC URL: https://rpc.sepolia.org
   - Chain ID: 11155111
   - Symbol: ETH
   - Explorer: https://sepolia.etherscan.io

2. Get testnet ETH:
   - [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
   - [Infura Faucet](https://www.infura.io/faucet/sepolia)

### 4. IPFS (Pinata)

1. Create account at [Pinata](https://pinata.cloud)
2. Generate API JWT token
3. Add to frontend `.env`

## Local Development

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Contracts

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with private key

# Compile
npm run compile

# Test
npm test

# Deploy to Sepolia
npm run deploy:sepolia
```

## Production Deployment

### 1. Deploy Contracts

```bash
cd contracts
npm run deploy:sepolia
```

Save the addresses from `deployments.json`.

### 2. Configure Frontend

Update `frontend/.env`:

```bash
VITE_PACT_FACTORY_ADDRESS=<from deployments.json>
VITE_PAYMASTER_ADDRESS=<from deployments.json>
VITE_ACCOUNT_FACTORY_ADDRESS=<from deployments.json>
```

### 3. Build & Deploy Frontend

```bash
cd frontend
npm run build
```

Deploy `dist/` folder to:
- Vercel
- Netlify
- Render
- Cloudflare Pages

## Environment Variables

### Frontend

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `VITE_SEPOLIA_RPC` | Sepolia RPC URL | No (default provided) |
| `VITE_PINATA_JWT` | Pinata JWT token | No |

### Contracts

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Deployer private key | Yes |
| `SEPOLIA_RPC` | Sepolia RPC URL | No |
| `ETHERSCAN_API_KEY` | For contract verification | No |

## Troubleshooting

### Wallet Connection Issues
- Check network is Sepolia
- Clear MetaMask cache
- Ensure sufficient test ETH

### Contract Deployment Fails
- Verify private key is correct
- Check wallet has Sepolia ETH
- Try a different RPC URL
