/**
 * Contract Addresses, ABIs, and Typed Instances
 * 
 * Deployed on Ethereum Sepolia (chainId: 11155111)
 */

import { ethers, Contract } from 'ethers';
import type { Signer, Provider } from 'ethers';

// ============================================================================
// Contract Addresses (Sepolia)
// ============================================================================

export const CONTRACT_ADDRESSES = {
    PACT_FACTORY: import.meta.env.VITE_PACT_FACTORY_ADDRESS || '0x47cE94bB1bedd7953Fb3917f37A28A79521cbFEB',
    ACCOUNT_FACTORY: import.meta.env.VITE_ACCOUNT_FACTORY_ADDRESS || '0xb355C259cbAF5c49e2768F166b3b0aCA37188c70',
    PAYMASTER: import.meta.env.VITE_PAYMASTER_ADDRESS || '0x2C8436727b1a1fC67A1b4d028cec6dffCCe1Ecb0',
    ENTRYPOINT: import.meta.env.VITE_ENTRYPOINT_ADDRESS || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
} as const;

// ============================================================================
// ABI Definitions
// ============================================================================

export const PACT_FACTORY_ABI = [
    // Events
    'event PactCreated(uint256 indexed pactId, address indexed pactAddress, address indexed user1, address user2, uint256 timestamp)',
    'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',

    // Read Functions
    'function getPact(uint256 pactId) view returns (tuple(uint256 pactId, address pactAddress, address user1, address user2, uint256 createdAt, bool isActive))',
    'function getUserPacts(address user) view returns (uint256[])',
    'function checkPactExists(address user1, address user2) view returns (bool hasPact, uint256 pactId)',
    'function totalPacts() view returns (uint256)',
    'function pacts(uint256) view returns (uint256 pactId, address pactAddress, address user1, address user2, uint256 createdAt, bool isActive)',
    'function nonces(address) view returns (uint256)',
    'function DOMAIN_SEPARATOR() view returns (bytes32)',
    'function PACT_CREATION_TYPEHASH() view returns (bytes32)',

    // Write Functions
    'function createPact(address user1, address user2) returns (uint256 pactId, address pactAddress)',
    'function createPactWithSignature(address user1, address user2, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (uint256 pactId, address pactAddress)',
] as const;

export const BINARY_PACT_ABI = [
    // Events
    'event PublicKeyUpdated(address indexed user, bytes publicKey)',
    'event SessionKeyRegistered(address indexed user, bytes32 indexed keyHash, uint256 expiresAt)',
    'event SessionKeyRotated(address indexed user, bytes32 indexed oldKeyHash, bytes32 indexed newKeyHash)',
    'event SessionKeyRevoked(address indexed user, bytes32 indexed keyHash)',
    'event MessageHashRegistered(bytes32 indexed messageHash, address indexed sender)',
    'event PactDissolved(uint256 indexed pactId, uint256 timestamp)',

    // Read Functions
    'function pactId() view returns (uint256)',
    'function user1() view returns (address)',
    'function user2() view returns (address)',
    'function factory() view returns (address)',
    'function createdAt() view returns (uint256)',
    'function isDissolved() view returns (bool)',
    'function dissolvedAt() view returns (uint256)',
    'function publicKeys(address) view returns (bytes)',
    'function getPartner(address user) view returns (address partner)',
    'function hasActiveSessionKey(address user) view returns (bool)',
    'function getSessionKeys(address user) view returns (tuple(bytes32 keyHash, uint256 createdAt, uint256 expiresAt, bool isActive)[])',
    'function getStatus() view returns (bool isActive, uint256 created, uint256 dissolved)',
    'function nonces(address) view returns (uint256)',

    // Write Functions
    'function registerPublicKey(bytes calldata publicKey)',
    'function registerSessionKey(bytes32 keyHash, uint256 validityPeriod)',
    'function rotateSessionKey(bytes32 newKeyHash, uint256 validityPeriod)',
    'function revokeSessionKey(bytes32 keyHash)',
    'function registerMessageHash(bytes32 messageHash)',
    'function dissolvePact(uint256 deadline, tuple(bytes32 r1, bytes32 s1, uint8 v1, bytes32 r2, bytes32 s2, uint8 v2) sig)',
] as const;

export const ACCOUNT_FACTORY_ABI = [
    'function createAccount(address owner, uint256 salt) returns (address)',
    'function getAddress(address owner, uint256 salt) view returns (address)',
] as const;

export const SMART_ACCOUNT_ABI = [
    'function execute(address dest, uint256 value, bytes calldata func)',
    'function executeBatch(address[] calldata dest, bytes[] calldata func)',
    'function owner() view returns (address)',
    'function getNonce() view returns (uint256)',
] as const;

export const ENTRYPOINT_ABI = [
    'function getNonce(address sender, uint192 key) view returns (uint256)',
    'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary)',
    'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
] as const;

export const PAYMASTER_ABI = [
    'function validatePaymasterUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 maxCost) view returns (bytes context, uint256 validationData)',
    'function deposit() payable',
    'function getDeposit() view returns (uint256)',
] as const;

// ============================================================================
// Pact Metadata Type
// ============================================================================

export interface PactMetadata {
    pactId: bigint;
    pactAddress: string;
    user1: string;
    user2: string;
    createdAt: bigint;
    isActive: boolean;
}

export interface SessionKey {
    keyHash: string;
    createdAt: bigint;
    expiresAt: bigint;
    isActive: boolean;
}

// ============================================================================
// Contract Factory Functions
// ============================================================================

/**
 * Get PactFactory contract instance
 */
export const getPactFactory = (signerOrProvider: Signer | Provider): Contract => {
    return new Contract(CONTRACT_ADDRESSES.PACT_FACTORY, PACT_FACTORY_ABI, signerOrProvider);
};

/**
 * Get BinaryPact contract instance
 */
export const getBinaryPact = (pactAddress: string, signerOrProvider: Signer | Provider): Contract => {
    return new Contract(pactAddress, BINARY_PACT_ABI, signerOrProvider);
};

/**
 * Get AccountFactory contract instance
 */
export const getAccountFactory = (signerOrProvider: Signer | Provider): Contract => {
    return new Contract(CONTRACT_ADDRESSES.ACCOUNT_FACTORY, ACCOUNT_FACTORY_ABI, signerOrProvider);
};

/**
 * Get EntryPoint contract instance
 */
export const getEntryPoint = (signerOrProvider: Signer | Provider): Contract => {
    return new Contract(CONTRACT_ADDRESSES.ENTRYPOINT, ENTRYPOINT_ABI, signerOrProvider);
};

// ============================================================================
// EIP-712 Domain
// ============================================================================

export const PACT_FACTORY_DOMAIN = {
    name: 'DuoGraphPactFactory',
    version: '1',
    chainId: 11155111, // Sepolia
    verifyingContract: CONTRACT_ADDRESSES.PACT_FACTORY,
};

export const PACT_CREATION_TYPES = {
    CreatePact: [
        { name: 'user1', type: 'address' },
        { name: 'user2', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
    ],
};

/**
 * Sign pact creation message for gasless creation
 */
export const signPactCreation = async (
    signer: ethers.Signer,
    user1: string,
    user2: string,
    nonce: bigint,
    deadline: bigint
): Promise<{ v: number; r: string; s: string }> => {
    const message = {
        user1,
        user2,
        nonce,
        deadline,
    };

    const signature = await (signer as ethers.Signer & { signTypedData: (domain: typeof PACT_FACTORY_DOMAIN, types: typeof PACT_CREATION_TYPES, message: object) => Promise<string> }).signTypedData(
        PACT_FACTORY_DOMAIN,
        PACT_CREATION_TYPES,
        message
    );

    const { v, r, s } = ethers.Signature.from(signature);
    return { v, r, s };
};
