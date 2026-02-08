/**
 * Wallet Connection Module
 * 
 * Handles MetaMask connection, network switching, and wallet state management.
 */

import { BrowserProvider } from 'ethers';
import type { Signer } from 'ethers';
import { SEPOLIA_CONFIG, getBrowserProvider } from '../lib/web3';

// ============================================================================
// Types
// ============================================================================

export interface WalletState {
    /** Whether wallet is connected */
    isConnected: boolean;
    /** Connected account address */
    address: string | null;
    /** Whether on correct network (Sepolia) */
    isCorrectNetwork: boolean;
    /** Chain ID */
    chainId: number | null;
    /** Error message if any */
    error: string | null;
}

type WalletChangeCallback = (state: WalletState) => void;

// ============================================================================
// State
// ============================================================================

let currentState: WalletState = {
    isConnected: false,
    address: null,
    isCorrectNetwork: false,
    chainId: null,
    error: null,
};

const listeners: Set<WalletChangeCallback> = new Set();

// ============================================================================
// Internal Helpers
// ============================================================================

const updateState = (updates: Partial<WalletState>): void => {
    currentState = { ...currentState, ...updates };
    listeners.forEach(cb => cb(currentState));
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Connect to MetaMask wallet.
 */
export const connectWallet = async (): Promise<WalletState> => {
    // Check if MetaMask is available
    if (typeof window === 'undefined' || !window.ethereum) {
        updateState({
            isConnected: false,
            error: 'MetaMask not detected. Please install MetaMask extension.',
        });
        return currentState;
    }

    try {
        const provider = new BrowserProvider(window.ethereum);

        // Request account access
        const accounts = await provider.send('eth_requestAccounts', []);

        if (!accounts || accounts.length === 0) {
            updateState({
                isConnected: false,
                error: 'No accounts found. Please unlock MetaMask.',
            });
            return currentState;
        }

        const address = accounts[0];
        const network = await provider.getNetwork();
        const isCorrectNetwork = Number(network.chainId) === SEPOLIA_CONFIG.chainId;

        updateState({
            isConnected: true,
            address,
            isCorrectNetwork,
            chainId: Number(network.chainId),
            error: null,
        });

        // Set up event listeners
        setupEventListeners();

        return currentState;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect wallet';
        updateState({
            isConnected: false,
            error: message,
        });
        return currentState;
    }
};

/**
 * Disconnect wallet (clear state).
 */
export const disconnectWallet = (): void => {
    updateState({
        isConnected: false,
        address: null,
        isCorrectNetwork: false,
        chainId: null,
        error: null,
    });
};

/**
 * Get current wallet state.
 */
export const getWalletState = (): WalletState => {
    return { ...currentState };
};

/**
 * Subscribe to wallet state changes.
 */
export const onWalletChange = (callback: WalletChangeCallback): (() => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

/**
 * Ensure connected to Sepolia network, switch if needed.
 */
export const ensureSepoliaNetwork = async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
        // Try to switch
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CONFIG.chainIdHex }],
        });

        updateState({ isCorrectNetwork: true, chainId: SEPOLIA_CONFIG.chainId });
        return true;
    } catch (switchError: unknown) {
        // Chain not added, try to add it
        if ((switchError as { code: number }).code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: SEPOLIA_CONFIG.chainIdHex,
                        chainName: SEPOLIA_CONFIG.name,
                        nativeCurrency: SEPOLIA_CONFIG.nativeCurrency,
                        rpcUrls: [SEPOLIA_CONFIG.rpcUrl],
                        blockExplorerUrls: [SEPOLIA_CONFIG.blockExplorer],
                    }],
                });

                updateState({ isCorrectNetwork: true, chainId: SEPOLIA_CONFIG.chainId });
                return true;
            } catch {
                updateState({ error: 'Failed to add Sepolia network' });
                return false;
            }
        }

        updateState({ error: 'Failed to switch to Sepolia network' });
        return false;
    }
};

/**
 * Get signer for signing transactions.
 */
export const getSigner = async (): Promise<Signer | null> => {
    const provider = await getBrowserProvider();
    if (!provider) return null;

    try {
        return await provider.getSigner();
    } catch {
        return null;
    }
};

/**
 * Sign a message with connected wallet.
 */
export const signMessage = async (message: string): Promise<string | null> => {
    const signer = await getSigner();
    if (!signer) return null;

    try {
        return await signer.signMessage(message);
    } catch {
        return null;
    }
};

/**
 * Get ETH balance of connected account.
 */
export const getBalance = async (): Promise<bigint | null> => {
    if (!currentState.address) return null;

    const provider = await getBrowserProvider();
    if (!provider) return null;

    try {
        return await provider.getBalance(currentState.address);
    } catch {
        return null;
    }
};

// ============================================================================
// Event Listeners
// ============================================================================

let listenersSetup = false;

const setupEventListeners = (): void => {
    if (listenersSetup || !window.ethereum) return;
    listenersSetup = true;

    // Account changed
    window.ethereum.on('accountsChanged', async (accounts: unknown) => {
        const accountsArray = accounts as string[];
        if (accountsArray.length === 0) {
            disconnectWallet();
        } else {
            updateState({ address: accountsArray[0] });
        }
    });

    // Chain changed
    window.ethereum.on('chainChanged', async (chainId: unknown) => {
        const chainIdNum = parseInt(chainId as string, 16);
        updateState({
            chainId: chainIdNum,
            isCorrectNetwork: chainIdNum === SEPOLIA_CONFIG.chainId,
        });
    });

    // Disconnect
    window.ethereum.on('disconnect', () => {
        disconnectWallet();
    });
};

/**
 * Initialize wallet state on page load (check if already connected).
 */
export const initializeWallet = async (): Promise<WalletState> => {
    if (!window.ethereum) {
        return currentState;
    }

    try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_accounts', []);

        if (accounts && accounts.length > 0) {
            const network = await provider.getNetwork();
            updateState({
                isConnected: true,
                address: accounts[0],
                isCorrectNetwork: Number(network.chainId) === SEPOLIA_CONFIG.chainId,
                chainId: Number(network.chainId),
                error: null,
            });
            setupEventListeners();
        }
    } catch {
        // Silent fail on init
    }

    return currentState;
};
