import { ethers } from 'ethers';

// Base Sepolia Testnet Configuration
export const BASE_SEPOLIA_CONFIG = {
    chainId: 84532,
    chainIdHex: '0x14a34',
    name: 'Base Sepolia',
    rpcUrl: import.meta.env.VITE_BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
    },
};

// Provider singleton
let provider: ethers.JsonRpcProvider | null = null;

export const getProvider = (): ethers.JsonRpcProvider => {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_CONFIG.rpcUrl);
    }
    return provider;
};

// Get browser wallet provider (MetaMask, etc.)
export const getBrowserProvider = async (): Promise<ethers.BrowserProvider | null> => {
    if (typeof window !== 'undefined' && window.ethereum) {
        return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
};

// Request wallet connection
export const connectWallet = async (): Promise<string | null> => {
    const browserProvider = await getBrowserProvider();
    if (!browserProvider) {
        console.error('No wallet detected. Please install MetaMask.');
        return null;
    }

    try {
        const accounts = await browserProvider.send('eth_requestAccounts', []);
        return accounts[0] || null;
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        return null;
    }
};

// Switch to Base Sepolia network
export const switchToBaseSepolia = async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_SEPOLIA_CONFIG.chainIdHex }],
        });
        return true;
    } catch (switchError: unknown) {
        // Chain not added, try to add it
        if ((switchError as { code: number }).code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: BASE_SEPOLIA_CONFIG.chainIdHex,
                            chainName: BASE_SEPOLIA_CONFIG.name,
                            nativeCurrency: BASE_SEPOLIA_CONFIG.nativeCurrency,
                            rpcUrls: [BASE_SEPOLIA_CONFIG.rpcUrl],
                            blockExplorerUrls: [BASE_SEPOLIA_CONFIG.blockExplorer],
                        },
                    ],
                });
                return true;
            } catch (addError) {
                console.error('Failed to add Base Sepolia network:', addError);
                return false;
            }
        }
        console.error('Failed to switch network:', switchError);
        return false;
    }
};

// Get current connected address
export const getConnectedAddress = async (): Promise<string | null> => {
    const browserProvider = await getBrowserProvider();
    if (!browserProvider) return null;

    try {
        const signer = await browserProvider.getSigner();
        return await signer.getAddress();
    } catch {
        return null;
    }
};

// Get signer for transactions
export const getSigner = async (): Promise<ethers.Signer | null> => {
    const browserProvider = await getBrowserProvider();
    if (!browserProvider) return null;

    try {
        return await browserProvider.getSigner();
    } catch {
        return null;
    }
};

// Format address for display
export const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Ethereum window type declaration
declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            on: (event: string, callback: (...args: unknown[]) => void) => void;
            removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
        };
    }
}
