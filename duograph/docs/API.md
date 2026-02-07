# DuoGraph API Documentation

## Overview

DuoGraph is a blockchain-anchored, two-person encrypted chat system. This document covers the APIs, protocols, and data structures used.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Frontend      │◄───►│   Supabase      │     │   Blockchain    │
│   (React)       │     │   (Metadata)    │     │   (Base Sepolia)│
│                 │     │                 │     │                 │
└────────┬────────┘     └─────────────────┘     └────────▲────────┘
         │                                               │
         │              ┌─────────────────┐              │
         │              │                 │              │
         └─────────────►│   WebRTC P2P    │◄─────────────┘
                        │   (Encrypted)   │
                        │                 │
                        └─────────────────┘
```

## Supabase Schema

### Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  wallet_address TEXT,
  public_key JSONB,
  key_fingerprint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `pacts`
```sql
CREATE TABLE pacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_pact_id INTEGER UNIQUE,
  initiator_id UUID REFERENCES users(id),
  partner_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  encrypted_metadata TEXT,
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  dissolved_at TIMESTAMP WITH TIME ZONE
);
```

#### `encrypted_messages`
```sql
CREATE TABLE encrypted_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pact_id UUID REFERENCES pacts(id),
  sender_id UUID REFERENCES users(id),
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  ipfs_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Smart Contract ABI

### BinaryPact

```json
[
  {
    "name": "createPact",
    "type": "function",
    "inputs": [
      { "name": "partner", "type": "address" },
      { "name": "encryptedMetadata", "type": "bytes32" }
    ],
    "outputs": [{ "name": "pactId", "type": "uint256" }]
  },
  {
    "name": "acceptPact",
    "type": "function",
    "inputs": [{ "name": "pactId", "type": "uint256" }]
  },
  {
    "name": "dissolvePact",
    "type": "function",
    "inputs": [{ "name": "pactId", "type": "uint256" }]
  },
  {
    "name": "registerPublicKey",
    "type": "function",
    "inputs": [{ "name": "publicKey", "type": "bytes" }]
  },
  {
    "name": "getPact",
    "type": "function",
    "inputs": [{ "name": "pactId", "type": "uint256" }],
    "outputs": [{ "name": "", "type": "tuple" }]
  }
]
```

## Encryption Protocol

### Key Exchange (X3DH)

1. Each user generates an ECDH P-256 key pair
2. Public keys are registered on-chain via `registerPublicKey()`
3. Key exchange occurs when pact is accepted
4. Shared secret derived using ECDH

### Message Encryption (Double Ratchet)

1. **Root Key**: Derived from X3DH shared secret
2. **Chain Keys**: Derived from root key for each message
3. **Message Keys**: One-time keys for AES-256-GCM encryption

```typescript
interface EncryptedMessage {
  header: {
    publicKey: JsonWebKey;    // DH ratchet public key
    previousChainLength: number;
    messageNumber: number;
  };
  iv: string;                 // Base64 encoded 12-byte IV
  ciphertext: string;         // Base64 encoded encrypted content
}
```

## WebRTC Signaling

### Signal Flow

1. Caller initiates signaling via Nostr relay (or Supabase realtime)
2. Signal types: `offer`, `answer`, `ice-candidate`
3. Connection established after ICE negotiation

### Signal Format

```typescript
interface RTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  pactId: string;
  fromUserId: string;
  toUserId: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  timestamp: number;
}
```

## IPFS Media Sharing

### Upload Flow

1. File encrypted client-side with shared pact key
2. Encrypted blob uploaded to IPFS via Pinata
3. IPFS hash stored in message metadata
4. Recipient downloads and decrypts using shared key

### File Metadata

```typescript
interface IPFSFileMetadata {
  name: string;
  type: string;           // MIME type
  size: number;
  encryptedKey: string;   // Encrypted file key
  iv: string;             // Encryption IV
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `PACT_NOT_FOUND` | Pact ID does not exist |
| `PACT_FULL` | Pact already has 2 participants |
| `NOT_PARTICIPANT` | User is not part of this pact |
| `ENCRYPTION_FAILED` | Failed to encrypt/decrypt message |
| `WEBRTC_FAILED` | WebRTC connection failed |
| `WALLET_NOT_CONNECTED` | No wallet connected |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Messages | 60/minute per pact |
| File uploads | 10/minute per user |
| Pact creation | 5/hour per user |
