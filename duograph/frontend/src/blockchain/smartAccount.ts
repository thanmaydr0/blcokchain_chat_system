/**
 * Smart Account Module (ERC-4337)
 * 
 * Manages counterfactual smart account addresses and deployment.
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, getAccountFactory, getEntryPoint } from './contracts';
import { getSigner } from './wallet';
import { getProvider } from '../lib/web3';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SALT = 0n;

// ============================================================================
// Types
// ============================================================================

export interface SmartAccountInfo {
    /** Smart account address (counterfactual or deployed) */
    address: string;
    /** Whether the account is deployed on-chain */
    isDeployed: boolean;
    /** Owner EOA address */
    owner: string;
    /** Current nonce */
    nonce: bigint;
}

// ============================================================================
// Account Address Derivation
// ============================================================================

/**
 * Get counterfactual smart account address for an owner.
 * This address is deterministic - same owner always gets same address.
 */
export const getSmartAccountAddress = async (
    ownerAddress: string,
    salt: bigint = DEFAULT_SALT
): Promise<string> => {
    const provider = getProvider();
    const factory = getAccountFactory(provider);

    try {
        // Use getFunction for dynamic ABI - Contract.getAddress exists in the ABI
        const address = await factory.getFunction('getAddress')(ownerAddress, salt);
        return address;
    } catch (error) {
        console.error('Failed to get smart account address:', error);
        throw new Error('Failed to derive smart account address');
    }
};

/**
 * Check if a smart account is deployed.
 */
export const isSmartAccountDeployed = async (accountAddress: string): Promise<boolean> => {
    const provider = getProvider();

    try {
        const code = await provider.getCode(accountAddress);
        return code !== '0x' && code !== '0x0';
    } catch {
        return false;
    }
};

/**
 * Get smart account nonce from EntryPoint.
 */
export const getSmartAccountNonce = async (accountAddress: string): Promise<bigint> => {
    const provider = getProvider();
    const entryPoint = getEntryPoint(provider);

    try {
        // Key 0 for standard nonces
        const nonce = await entryPoint.getNonce(accountAddress, 0);
        return nonce;
    } catch {
        return 0n;
    }
};

/**
 * Get full smart account info.
 */
export const getSmartAccountInfo = async (ownerAddress: string): Promise<SmartAccountInfo> => {
    const address = await getSmartAccountAddress(ownerAddress);
    const isDeployed = await isSmartAccountDeployed(address);
    const nonce = await getSmartAccountNonce(address);

    return {
        address,
        isDeployed,
        owner: ownerAddress,
        nonce,
    };
};

// ============================================================================
// Account Creation
// ============================================================================

/**
 * Create smart account deployment initCode.
 * This is used as part of the first UserOperation.
 */
export const getAccountInitCode = (ownerAddress: string, salt: bigint = DEFAULT_SALT): string => {
    const factoryInterface = new ethers.Interface([
        'function createAccount(address owner, uint256 salt) returns (address)',
    ]);

    const initCallData = factoryInterface.encodeFunctionData('createAccount', [ownerAddress, salt]);

    // initCode = factory address + calldata
    return ethers.concat([CONTRACT_ADDRESSES.ACCOUNT_FACTORY, initCallData]);
};

/**
 * Create smart account via direct transaction (requires gas).
 * Alternative to gasless UserOperation.
 */
export const createSmartAccount = async (
    salt: bigint = DEFAULT_SALT
): Promise<{ address: string; txHash: string }> => {
    const signer = await getSigner();
    if (!signer) {
        throw new Error('No signer available');
    }

    const ownerAddress = await signer.getAddress();
    const factory = getAccountFactory(signer);

    // Check if already deployed
    const expectedAddress = await getSmartAccountAddress(ownerAddress, salt);
    const isDeployed = await isSmartAccountDeployed(expectedAddress);

    if (isDeployed) {
        return { address: expectedAddress, txHash: '' };
    }

    try {
        const tx = await factory.createAccount(ownerAddress, salt);
        const receipt = await tx.wait();

        return {
            address: expectedAddress,
            txHash: receipt.hash,
        };
    } catch (error) {
        console.error('Failed to create smart account:', error);
        throw new Error('Failed to deploy smart account');
    }
};

// ============================================================================
// Calldata Encoding
// ============================================================================

/**
 * Encode calldata for smart account execute function.
 */
export const encodeExecuteCalldata = (
    target: string,
    value: bigint,
    data: string
): string => {
    const accountInterface = new ethers.Interface([
        'function execute(address dest, uint256 value, bytes calldata func)',
    ]);

    return accountInterface.encodeFunctionData('execute', [target, value, data]);
};

/**
 * Encode calldata for smart account executeBatch function.
 */
export const encodeExecuteBatchCalldata = (
    targets: string[],
    datas: string[]
): string => {
    const accountInterface = new ethers.Interface([
        'function executeBatch(address[] calldata dest, bytes[] calldata func)',
    ]);

    return accountInterface.encodeFunctionData('executeBatch', [targets, datas]);
};
