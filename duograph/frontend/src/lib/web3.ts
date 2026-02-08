import { ethers } from 'ethers';

// Ethereum Sepolia Testnet Configuration
export const SEPOLIA_CONFIG = {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    name: 'Sepolia',
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC || 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
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
        provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
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

// Switch to Sepolia network
export const switchToSepolia = async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CONFIG.chainIdHex }],
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
                            chainId: SEPOLIA_CONFIG.chainIdHex,
                            chainName: SEPOLIA_CONFIG.name,
                            nativeCurrency: SEPOLIA_CONFIG.nativeCurrency,
                            rpcUrls: [SEPOLIA_CONFIG.rpcUrl],
                            blockExplorerUrls: [SEPOLIA_CONFIG.blockExplorer],
                        },
                    ],
                });
                return true;
            } catch (addError) {
                console.error('Failed to add Sepolia network:', addError);
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

// Check if connected to correct network
export const isCorrectNetwork = async (): Promise<boolean> => {
    const browserProvider = await getBrowserProvider();
    if (!browserProvider) return false;

    try {
        const network = await browserProvider.getNetwork();
        return Number(network.chainId) === SEPOLIA_CONFIG.chainId;
    } catch {
        return false;
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
