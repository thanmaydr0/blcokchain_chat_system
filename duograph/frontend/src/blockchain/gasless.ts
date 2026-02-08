/**
 * Gasless Transaction Module
 * 
 * Handles ERC-4337 UserOperations with Paymaster for gas sponsorship.
 */

import { ethers } from 'ethers';
import type { Signer } from 'ethers';
import { CONTRACT_ADDRESSES, getEntryPoint } from './contracts';
import { getSigner } from './wallet';
import { getProvider, SEPOLIA_CONFIG } from '../lib/web3';
import {
    getSmartAccountAddress,
    isSmartAccountDeployed,
    getSmartAccountNonce,
    getAccountInitCode,
    encodeExecuteCalldata
} from './smartAccount';

// ============================================================================
// Constants
// ============================================================================

const BUNDLER_RPC = import.meta.env.VITE_BUNDLER_RPC || SEPOLIA_CONFIG.rpcUrl;

// Gas estimation defaults (conservative values)
const DEFAULT_GAS_LIMITS = {
    callGasLimit: 200000n,
    verificationGasLimit: 150000n,
    preVerificationGas: 50000n,
};

// ============================================================================
// Types
// ============================================================================

export interface UserOperation {
    sender: string;
    nonce: bigint;
    initCode: string;
    callData: string;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymasterAndData: string;
    signature: string;
}

export interface GaslessResult {
    success: boolean;
    userOpHash?: string;
    txHash?: string;
    error?: string;
}

export interface GaslessCallParams {
    target: string;
    value?: bigint;
    data: string;
}

// ============================================================================
// UserOperation Building
// ============================================================================

/**
 * Build a UserOperation for gasless execution.
 */
export const buildUserOperation = async (
    ownerAddress: string,
    callParams: GaslessCallParams
): Promise<UserOperation> => {
    const provider = getProvider();

    // Get smart account address
    const sender = await getSmartAccountAddress(ownerAddress);

    // Check if deployed
    const isDeployed = await isSmartAccountDeployed(sender);

    // Get initCode only if not deployed
    const initCode = isDeployed ? '0x' : getAccountInitCode(ownerAddress);

    // Get nonce
    const nonce = await getSmartAccountNonce(sender);

    // Encode callData
    const callData = encodeExecuteCalldata(
        callParams.target,
        callParams.value || 0n,
        callParams.data
    );

    // Get gas prices
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei');

    // Paymaster data - include paymaster address for sponsorship
    const paymasterAndData = CONTRACT_ADDRESSES.Paymaster;

    // Adjust gas limits if deploying account
    const gasLimits = {
        callGasLimit: DEFAULT_GAS_LIMITS.callGasLimit,
        verificationGasLimit: isDeployed
            ? DEFAULT_GAS_LIMITS.verificationGasLimit
            : DEFAULT_GAS_LIMITS.verificationGasLimit + 200000n,
        preVerificationGas: DEFAULT_GAS_LIMITS.preVerificationGas,
    };

    return {
        sender,
        nonce,
        initCode,
        callData,
        ...gasLimits,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData,
        signature: '0x', // Will be filled after signing
    };
};

/**
 * Sign a UserOperation.
 */
export const signUserOperation = async (
    userOp: UserOperation,
    signer: Signer
): Promise<string> => {
    const provider = getProvider();
    const entryPoint = getEntryPoint(provider);

    // Get UserOp hash from EntryPoint
    const userOpHash = await entryPoint.getUserOpHash(userOp);

    // Sign the hash
    const signature = await signer.signMessage(ethers.getBytes(userOpHash));

    return signature;
};

/**
 * Submit UserOperation to bundler.
 */
export const submitUserOperation = async (
    userOp: UserOperation
): Promise<GaslessResult> => {
    try {
        // Format UserOp for RPC
        const formattedOp = {
            sender: userOp.sender,
            nonce: ethers.toBeHex(userOp.nonce),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: ethers.toBeHex(userOp.callGasLimit),
            verificationGasLimit: ethers.toBeHex(userOp.verificationGasLimit),
            preVerificationGas: ethers.toBeHex(userOp.preVerificationGas),
            maxFeePerGas: ethers.toBeHex(userOp.maxFeePerGas),
            maxPriorityFeePerGas: ethers.toBeHex(userOp.maxPriorityFeePerGas),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
        };

        // Call bundler RPC
        const response = await fetch(BUNDLER_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendUserOperation',
                params: [formattedOp, CONTRACT_ADDRESSES.EntryPoint],
            }),
        });

        const result = await response.json();

        if (result.error) {
            return {
                success: false,
                error: result.error.message || 'Bundler rejected UserOperation',
            };
        }

        return {
            success: true,
            userOpHash: result.result,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to submit UserOperation',
        };
    }
};

/**
 * Wait for UserOperation to be mined.
 */
export const waitForUserOperation = async (
    userOpHash: string,
    timeout: number = 60000
): Promise<{ txHash: string } | null> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(BUNDLER_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getUserOperationReceipt',
                    params: [userOpHash],
                }),
            });

            const result = await response.json();

            if (result.result) {
                return { txHash: result.result.receipt.transactionHash };
            }
        } catch {
            // Continue polling
        }

        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return null;
};

// ============================================================================
// High-Level Gasless Execution
// ============================================================================

/**
 * Execute a contract call gaslessly via ERC-4337.
 */
export const executeGasless = async (
    callParams: GaslessCallParams
): Promise<GaslessResult> => {
    const signer = await getSigner();
    if (!signer) {
        return { success: false, error: 'No signer available' };
    }

    try {
        const ownerAddress = await signer.getAddress();

        // Build UserOperation
        const userOp = await buildUserOperation(ownerAddress, callParams);

        // Sign UserOperation
        userOp.signature = await signUserOperation(userOp, signer);

        // Submit to bundler
        const submitResult = await submitUserOperation(userOp);

        if (!submitResult.success) {
            // Fallback: try direct transaction
            return await executeDirectTransaction(signer, callParams);
        }

        // Wait for confirmation
        if (submitResult.userOpHash) {
            const receipt = await waitForUserOperation(submitResult.userOpHash);
            if (receipt) {
                return {
                    success: true,
                    userOpHash: submitResult.userOpHash,
                    txHash: receipt.txHash
                };
            }
        }

        return submitResult;
    } catch (error) {
        console.error('Gasless execution failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Gasless execution failed',
        };
    }
};

/**
 * Fallback: Execute via direct transaction (requires user gas).
 */
const executeDirectTransaction = async (
    signer: Signer,
    callParams: GaslessCallParams
): Promise<GaslessResult> => {
    try {
        const tx = await signer.sendTransaction({
            to: callParams.target,
            value: callParams.value || 0n,
            data: callParams.data,
        });

        const receipt = await tx.wait();

        return {
            success: true,
            txHash: receipt?.hash,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Direct transaction failed',
        };
    }
};

/**
 * Check if gasless transactions are available.
 */
export const isGaslessAvailable = async (): Promise<boolean> => {
    try {
        const response = await fetch(BUNDLER_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_supportedEntryPoints',
                params: [],
            }),
        });

        const result = await response.json();
        const entryPoints = result.result || [];

        return entryPoints.some(
            (ep: string) => ep.toLowerCase() === CONTRACT_ADDRESSES.EntryPoint.toLowerCase()
        );
    } catch {
        return false;
    }
};
