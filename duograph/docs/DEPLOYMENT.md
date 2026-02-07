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

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL migrations from `docs/API.md`
3. Enable Row Level Security (RLS) policies
4. Get your project URL and anon key

### 2. IPFS Setup (Pinata)

1. Create account at [pinata.cloud](https://pinata.cloud)
2. Generate a JWT token
3. Note your gateway URL

### 3. Base Sepolia Setup

1. Add Base Sepolia to MetaMask:
   - Network Name: Base Sepolia
   - RPC URL: https://sepolia.base.org
   - Chain ID: 84532
   - Symbol: ETH
   - Block Explorer: https://sepolia.basescan.org

2. Get testnet ETH:
   - [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

## Local Development

### Frontend

```bash
cd duograph/frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your credentials
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
# etc.

# Start development server
npm run dev
```

### Smart Contracts

```bash
cd duograph/contracts

# Install Foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install

# Build contracts
forge build

# Test contracts
forge test

# Deploy to Base Sepolia
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Production Deployment

### Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `cd duograph/frontend && npm install && npm run build`
   - **Start Command**: `cd duograph/frontend && npm run preview`
   - **Environment Variables**: Add all VITE_* variables

### Alternative: Static Site Deployment

1. Build the frontend:
   ```bash
   cd duograph/frontend
   npm run build
   ```

2. Deploy the `dist` folder to:
   - Vercel
   - Netlify
   - Cloudflare Pages

### Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `VITE_BASE_SEPOLIA_RPC` | Base Sepolia RPC URL | No (default provided) |
| `VITE_BUNDLER_URL` | ERC-4337 bundler URL | For gasless tx |
| `VITE_IPFS_GATEWAY` | IPFS gateway URL | For media |
| `VITE_PINATA_JWT` | Pinata JWT token | For uploads |

## Security Checklist

- [ ] Enable Supabase RLS policies
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS on production
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Audit smart contracts before mainnet

## Monitoring

### Supabase
- Enable database logging
- Set up alerts for auth failures

### Blockchain
- Monitor contract events using:
  - [Basescan](https://sepolia.basescan.org)
  - The Graph (for complex queries)

## Troubleshooting

### Common Issues

**Wallet not connecting**
- Ensure MetaMask is installed
- Check network is Base Sepolia
- Clear browser cache

**Messages not encrypting**
- Verify Web Crypto API is available (HTTPS required)
- Check key generation in IndexedDB

**WebRTC not connecting**
- Check STUN/TURN server availability
- Verify firewall allows UDP traffic
- Try different browser

## Support

For issues, open a GitHub issue or contact the development team.
