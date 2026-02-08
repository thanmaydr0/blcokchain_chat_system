# DuoGraph API Documentation

## Overview

DuoGraph is a blockchain-anchored, two-person encrypted chat system. This document covers the APIs, protocols, and data structures used.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Frontend    │     │     Supabase    │     │    Ethereum     │
│   (React)       │ ──▶ │   (Metadata)    │     │    (Sepolia)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               ▲
        │                                               │
        └───────────────────────────────────────────────┘
                    (Contract Interactions)
```

## Smart Contract ABI

### PactFactory

**Address**: Check `deployments.json` after deployment

```typescript
interface PactFactory {
  // Create a new pact between two users
  createPact(user1: address, user2: address): Promise<uint256>
  
  // Get pact by ID
  getPact(pactId: uint256): Promise<PactData>
  
  // Check if pact exists between users
  checkPactExists(user1: address, user2: address): Promise<[boolean, uint256]>
  
  // Get all pacts for a user
  getUserPacts(user: address): Promise<uint256[]>
}
```

### BinaryPact

```typescript
interface BinaryPact {
  // Immutable members
  user1: address     // First participant (immutable)
  user2: address     // Second participant (immutable)
  
  // Register encryption public key
  registerPublicKey(publicKey: bytes): Promise<void>
  
  // Session key management
  registerSessionKey(keyHash: bytes32, validityPeriod: uint256): Promise<void>
  rotateSessionKey(newKeyHash: bytes32, validityPeriod: uint256): Promise<void>
  
  // Message registry
  registerMessageHash(messageHash: bytes32): Promise<void>
  verifyMessageHash(messageHash: bytes32): Promise<boolean>
}
```

## Supabase Schema

### Tables

**users**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | User email |
| public_key_hash | text | Hash of encryption public key |
| created_at | timestamp | Account creation time |

**pacts**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| contract_address | text | On-chain pact address |
| user1_id | uuid | First participant |
| user2_id | uuid | Second participant |
| created_at | timestamp | Pact creation time |

**messages** (metadata only)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| pact_id | uuid | Associated pact |
| sender_id | uuid | Message sender |
| ipfs_hash | text | IPFS CID of encrypted content |
| created_at | timestamp | Send time |

## Encryption Protocol

### Key Exchange

1. Users generate ECDH keypairs (P-256)
2. Public keys registered on-chain
3. Shared secret derived using ECDH
4. Session keys rotated regularly

### Message Encryption

```
plaintext → compress → encrypt (AES-256-GCM) → upload to IPFS → store CID in Supabase
```

## WebRTC Signaling

Uses Supabase Realtime for signaling:

```typescript
// Channel name format
const channel = `pact:${pactId}`

// Events
- offer: SDP offer
- answer: SDP answer
- ice-candidate: ICE candidate
```

## Network Configuration

| Network | Chain ID | RPC |
|---------|----------|-----|
| Sepolia | 11155111 | https://rpc.sepolia.org |
