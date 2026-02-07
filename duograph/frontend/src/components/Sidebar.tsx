import { useState } from 'react';
import { MessageSquare, Plus, Settings, LogOut, Shield, Link2 } from 'lucide-react';
import { WalletConnect } from './auth/WalletConnect';
import { useAuthStore, usePactStore, useUIStore } from '../store';
import type { Pact } from '../types';

export const Sidebar = () => {
    const { user, logout, walletAddress } = useAuthStore();
    const { pacts, activePact, setActivePact } = usePactStore();
    const { sidebarOpen, openModal } = useUIStore();
    const [hoveredPact, setHoveredPact] = useState<string | null>(null);

    if (!sidebarOpen) return null;

    return (
        <aside className="w-80 h-full flex flex-col bg-dark-900 border-r border-dark-700">
            {/* Header */}
            <div className="p-4 border-b border-dark-700">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gradient">DuoGraph</h1>
                        <p className="text-xs text-dark-500">Encrypted P2P Chat</p>
                    </div>
                </div>

                {/* Wallet Connection */}
                {!walletAddress && (
                    <div className="mt-4">
                        <WalletConnect />
                    </div>
                )}
            </div>

            {/* New Pact Button */}
            <div className="p-4">
                <button
                    onClick={() => openModal('new-pact')}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    New Pact
                </button>
            </div>

            {/* Pacts List */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="px-2 py-1 mb-2">
                    <span className="text-xs font-medium text-dark-500 uppercase tracking-wider">
                        Pacts
                    </span>
                </div>

                {pacts.length === 0 ? (
                    <div className="p-4 text-center">
                        <MessageSquare className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                        <p className="text-sm text-dark-500">No active pacts</p>
                        <p className="text-xs text-dark-600 mt-1">
                            Create a pact to start chatting
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {pacts.map((pact: Pact) => (
                            <button
                                key={pact.id}
                                onClick={() => setActivePact(pact)}
                                onMouseEnter={() => setHoveredPact(pact.id)}
                                onMouseLeave={() => setHoveredPact(null)}
                                className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${activePact?.id === pact.id
                                        ? 'bg-duo-500/10 border border-duo-500/30'
                                        : 'hover:bg-dark-800 border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center text-white font-medium">
                                            {pact.partner?.email?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <span
                                            className={`absolute bottom-0 right-0 ${pact.status === 'active'
                                                    ? 'status-online'
                                                    : pact.status === 'pending'
                                                        ? 'status-connecting'
                                                        : 'status-offline'
                                                }`}
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-dark-100 truncate">
                                                {pact.partner?.email?.split('@')[0] || 'Pending...'}
                                            </span>
                                            {pact.status === 'active' && (
                                                <Shield className="w-3 h-3 text-green-400" />
                                            )}
                                        </div>
                                        <p className="text-xs text-dark-500 truncate">
                                            {pact.status === 'pending'
                                                ? 'Waiting for acceptance'
                                                : 'End-to-end encrypted'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* User Section */}
            <div className="p-4 border-t border-dark-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-duo-500 to-duo-600 flex items-center justify-center text-white font-medium">
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-100 truncate">
                                {user?.email?.split('@')[0] || 'User'}
                            </p>
                            <p className="text-xs text-dark-500 truncate">{user?.email}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => openModal('settings')}
                            className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800 transition-colors"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <button
                            onClick={logout}
                            className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-800 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
