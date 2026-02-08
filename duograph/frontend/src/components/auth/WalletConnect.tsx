import { useState, useEffect } from 'react';
import { Wallet, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
    connectWallet,
    switchToSepolia,
    getConnectedAddress,
    formatAddress,
    SEPOLIA_CONFIG,
} from '../../lib/web3';
import { useAuthStore } from '../../store';

interface WalletConnectProps {
    onConnect?: (address: string) => void;
}

export const WalletConnect = ({ onConnect }: WalletConnectProps) => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

    const { walletAddress, setWalletAddress } = useAuthStore();

    // Check if already connected
    useEffect(() => {
        const checkConnection = async () => {
            const address = await getConnectedAddress();
            if (address) {
                setWalletAddress(address);
                onConnect?.(address);
            }
        };
        checkConnection();
    }, [setWalletAddress, onConnect]);

    // Listen for account changes
    useEffect(() => {
        if (window.ethereum) {
            const handleAccountsChanged = (accounts: unknown) => {
                const accountList = accounts as string[];
                if (accountList.length === 0) {
                    setWalletAddress(null);
                } else {
                    setWalletAddress(accountList[0]);
                    onConnect?.(accountList[0]);
                }
            };

            const handleChainChanged = (chainId: unknown) => {
                setIsCorrectNetwork((chainId as string) === SEPOLIA_CONFIG.chainIdHex);
            };

            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum?.removeListener('chainChanged', handleChainChanged);
            };
        }
    }, [setWalletAddress, onConnect]);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);

        try {
            // Connect wallet
            const address = await connectWallet();
            if (!address) {
                throw new Error('Failed to connect wallet. Please install MetaMask.');
            }

            // Switch to Sepolia
            const switched = await switchToSepolia();
            if (!switched) {
                throw new Error('Failed to switch to Sepolia network.');
            }

            setWalletAddress(address);
            setIsCorrectNetwork(true);
            onConnect?.(address);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSwitchNetwork = async () => {
        setIsConnecting(true);
        try {
            await switchToSepolia();
            setIsCorrectNetwork(true);
        } catch {
            setError('Failed to switch network');
        } finally {
            setIsConnecting(false);
        }
    };

    if (walletAddress && isCorrectNetwork) {
        return (
            <div className="glass-card p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-dark-400">Connected Wallet</p>
                            <p className="font-mono font-medium text-dark-100">
                                {formatAddress(walletAddress)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="status-online" />
                        <span className="text-sm text-dark-400">Sepolia</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-duo-500/10 mb-4">
                    <Wallet className="w-7 h-7 text-duo-400" />
                </div>
                <h3 className="text-lg font-semibold text-dark-100 mb-2">
                    Connect Your Wallet
                </h3>
                <p className="text-sm text-dark-400">
                    Connect to create blockchain-anchored pacts with your chat partner.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {walletAddress && !isCorrectNetwork ? (
                <button
                    onClick={handleSwitchNetwork}
                    disabled={isConnecting}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {isConnecting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <AlertCircle className="w-5 h-5" />
                            Switch to Sepolia
                        </>
                    )}
                </button>
            ) : (
                <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {isConnecting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <Wallet className="w-5 h-5" />
                            Connect Wallet
                        </>
                    )}
                </button>
            )}

            <p className="text-xs text-dark-500 text-center mt-4">
                Supports MetaMask, Coinbase Wallet, and other Web3 wallets
            </p>
        </div>
    );
};

export default WalletConnect;
