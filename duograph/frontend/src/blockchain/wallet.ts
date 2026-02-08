import { create } from 'zustand';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

// Window.ethereum type is declared in ../lib/web3.ts

interface WalletState {
    provider: BrowserProvider | null;
    signer: JsonRpcSigner | null;
    address: string | null;
    chainId: number | null;
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;

    setProvider: (provider: BrowserProvider | null) => void;
    setSigner: (signer: JsonRpcSigner | null) => void;
    setAddress: (address: string | null) => void;
    setChainId: (chainId: number | null) => void;
    setConnecting: (isConnecting: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    error: null,

    setProvider: (provider) => set({ provider }),
    setSigner: (signer) => set({ signer }),
    setAddress: (address) => set({ address, isConnected: !!address }),
    setChainId: (chainId) => set({ chainId }),
    setConnecting: (isConnecting) => set({ isConnecting }),
    setError: (error) => set({ error }),
    reset: () => set({
        provider: null,
        signer: null,
        address: null,
        chainId: null,
        isConnected: false,
        isConnecting: false,
        error: null
    }),
}));

export const connectWallet = async () => {
    const store = useWalletStore.getState();
    store.setConnecting(true);
    store.setError(null);

    try {
        if (!window.ethereum) {
            throw new Error("MetaMask (or compatible wallet) not installed");
        }

        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);

        if (accounts.length === 0) {
            throw new Error("No accounts found");
        }

        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();

        store.setProvider(provider);
        store.setSigner(signer);
        store.setAddress(address);
        store.setChainId(Number(network.chainId));

        return { address, provider, signer };
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Failed to connect wallet:", err);
        store.setError(error.message || "Failed to connect wallet");
        throw err;
    } finally {
        store.setConnecting(false);
    }
};

export const disconnectWallet = () => {
    const store = useWalletStore.getState();
    store.reset();
};

export const getSigner = () => {
    const store = useWalletStore.getState();
    return store.signer;
};

export const getProvider = () => {
    const store = useWalletStore.getState();
    return store.provider;
};

// Setup listeners for account/chain changes
export const setupWalletListeners = () => {
    if (!window.ethereum || !window.ethereum.on) return;

    const handleAccountsChanged = async (...args: unknown[]) => {
        const accounts = args[0] as string[];
        const store = useWalletStore.getState();
        if (accounts.length === 0) {
            store.reset();
        } else if (store.provider) {
            // Update signer and address
            const signer = await store.provider.getSigner();
            const address = await signer.getAddress();
            store.setSigner(signer);
            store.setAddress(address);
        }
    };

    const handleChainChanged = () => {
        // Reload page is recommended by MetaMask, but we can just update state if robust
        // For now, let's update chainId
        const store = useWalletStore.getState();
        if (store.provider) {
            store.provider.getNetwork().then(network => {
                store.setChainId(Number(network.chainId));
            });
        }
        // Ideally reload: window.location.reload(); 
    };

    // Use window.ethereum.on for event listeners - types are defined in lib/web3.ts
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
        if (window.ethereum?.removeListener) {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
    };
};
