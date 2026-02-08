/**
 * Settings Panel Component
 * 
 * Security settings, pact details, and account management.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '@headlessui/react';
import {
    ShieldCheckIcon,
    KeyIcon,
    LinkIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    DevicePhoneMobileIcon,
    CameraIcon,
    FingerPrintIcon,
} from '@heroicons/react/24/solid';
import { Button } from '../shared/Button';
import { PrivacyBadge, BlockchainAnchor } from '../shared/PrivacyBadge';

// ============================================================================
// Types
// ============================================================================

export interface PactDetails {
    id: string;
    contractAddress: string;
    createdAt: Date;
    partnerAddress: string;
    partnerName: string;
    messageCount: number;
    lastSyncedAt: Date;
}

export interface SecuritySettings {
    biometricEnabled: boolean;
    screenshotPreventionEnabled: boolean;
    autoLockMinutes: number;
    sessionKeyRotationDays: number;
}

export interface SettingsPanelProps {
    pact: PactDetails;
    settings: SecuritySettings;
    onUpdateSettings: (settings: Partial<SecuritySettings>) => void;
    onRotateSessionKey: () => Promise<void>;
    onVerifyIntegrity: () => Promise<void>;
    onRevokePact: () => Promise<void>;
    onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const SettingsPanel = ({
    pact,
    settings,
    onUpdateSettings,
    onRotateSessionKey,
    onVerifyIntegrity,
    onRevokePact,
    onClose,
}: SettingsPanelProps) => {
    const [activeTab, setActiveTab] = useState<'pact' | 'security' | 'danger'>('pact');
    const [isRotating, setIsRotating] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const handleRotateKey = async () => {
        setIsRotating(true);
        await onRotateSessionKey();
        setIsRotating(false);
    };

    const handleVerify = async () => {
        setIsVerifying(true);
        await onVerifyIntegrity();
        setIsVerifying(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-700/50 shadow-2xl z-50"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                <h2 className="text-xl font-semibold text-white">Settings</h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
                {(['pact', 'security', 'danger'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`
                            flex-1 px-4 py-3 text-sm font-medium transition-colors
                            ${activeTab === tab
                                ? 'text-purple-400 border-b-2 border-purple-400'
                                : 'text-slate-400 hover:text-white'
                            }
                        `}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                {activeTab === 'pact' && (
                    <PactDetailsTab
                        pact={pact}
                        isVerifying={isVerifying}
                        onVerify={handleVerify}
                    />
                )}

                {activeTab === 'security' && (
                    <SecurityTab
                        settings={settings}
                        onUpdateSettings={onUpdateSettings}
                        isRotating={isRotating}
                        onRotateKey={handleRotateKey}
                    />
                )}

                {activeTab === 'danger' && (
                    <DangerTab onRevokePact={onRevokePact} />
                )}
            </div>
        </motion.div>
    );
};

// ============================================================================
// Pact Details Tab
// ============================================================================

const PactDetailsTab = ({
    pact,
    isVerifying,
    onVerify,
}: {
    pact: PactDetails;
    isVerifying: boolean;
    onVerify: () => void;
}) => {
    return (
        <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3">
                <PrivacyBadge status="secure" />
                <PrivacyBadge status="blockchain" />
            </div>

            {/* Contract Address */}
            <DetailRow
                icon={<LinkIcon className="w-5 h-5 text-blue-400" />}
                label="Contract Address"
                value={
                    <BlockchainAnchor
                        txHash={pact.contractAddress}
                        onClick={() => window.open(`https://sepolia.etherscan.io/address/${pact.contractAddress}`)}
                    />
                }
            />

            {/* Partner */}
            <DetailRow
                icon={<DevicePhoneMobileIcon className="w-5 h-5 text-purple-400" />}
                label="Pact Partner"
                value={
                    <div>
                        <p className="text-white font-medium">{pact.partnerName}</p>
                        <p className="text-xs text-slate-500 font-mono">
                            {shortenAddress(pact.partnerAddress)}
                        </p>
                    </div>
                }
            />

            {/* Created */}
            <DetailRow
                icon={<ShieldCheckIcon className="w-5 h-5 text-emerald-400" />}
                label="Created"
                value={pact.createdAt.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}
            />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
                <StatCard label="Messages" value={pact.messageCount.toLocaleString()} />
                <StatCard label="Last Sync" value={formatTimeAgo(pact.lastSyncedAt)} />
            </div>

            {/* Verify Button */}
            <Button
                fullWidth
                variant="secondary"
                onClick={onVerify}
                isLoading={isVerifying}
                leftIcon={<ShieldCheckIcon className="w-5 h-5" />}
            >
                Verify Message Integrity
            </Button>
        </div>
    );
};

// ============================================================================
// Security Tab
// ============================================================================

const SecurityTab = ({
    settings,
    onUpdateSettings,
    isRotating,
    onRotateKey,
}: {
    settings: SecuritySettings;
    onUpdateSettings: (s: Partial<SecuritySettings>) => void;
    isRotating: boolean;
    onRotateKey: () => void;
}) => {
    return (
        <div className="space-y-6">
            {/* Biometric */}
            <SettingToggle
                icon={<FingerPrintIcon className="w-5 h-5 text-purple-400" />}
                title="Biometric Unlock"
                description="Use fingerprint or Face ID to unlock"
                enabled={settings.biometricEnabled}
                onChange={(enabled) => onUpdateSettings({ biometricEnabled: enabled })}
            />

            {/* Screenshot Prevention */}
            <SettingToggle
                icon={<CameraIcon className="w-5 h-5 text-amber-400" />}
                title="Screenshot Prevention"
                description="Block screenshots in the app"
                enabled={settings.screenshotPreventionEnabled}
                onChange={(enabled) => onUpdateSettings({ screenshotPreventionEnabled: enabled })}
            />

            {/* Session Key Rotation */}
            <div className="pt-4 border-t border-slate-700/50">
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-slate-800">
                        <KeyIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-medium text-white">Session Keys</h4>
                        <p className="text-sm text-slate-400 mt-1">
                            Keys rotate every {settings.sessionKeyRotationDays} days
                        </p>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="mt-3"
                            onClick={onRotateKey}
                            isLoading={isRotating}
                            leftIcon={<ArrowPathIcon className="w-4 h-4" />}
                        >
                            Rotate Now
                        </Button>
                    </div>
                </div>
            </div>

            {/* Auto-lock */}
            <div className="pt-4 border-t border-slate-700/50">
                <h4 className="font-medium text-white mb-3">Auto-Lock Timeout</h4>
                <div className="grid grid-cols-4 gap-2">
                    {[1, 5, 15, 30].map((mins) => (
                        <button
                            key={mins}
                            onClick={() => onUpdateSettings({ autoLockMinutes: mins })}
                            className={`
                                px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${settings.autoLockMinutes === mins
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }
                            `}
                        >
                            {mins}m
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Danger Tab
// ============================================================================

const DangerTab = ({ onRevokePact }: { onRevokePact: () => void }) => {
    const [confirmText, setConfirmText] = useState('');
    const canRevoke = confirmText.toLowerCase() === 'revoke';

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0" />
                    <div>
                        <h4 className="font-medium text-red-400">Emergency Pact Revocation</h4>
                        <p className="text-sm text-slate-400 mt-1">
                            This will permanently destroy the pact. All messages will be lost and cannot be recovered.
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm text-slate-400 mb-2">
                    Type "REVOKE" to confirm
                </label>
                <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="REVOKE"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
            </div>

            <Button
                fullWidth
                variant="danger"
                disabled={!canRevoke}
                onClick={onRevokePact}
            >
                Permanently Revoke Pact
            </Button>
        </div>
    );
};

// ============================================================================
// Sub-Components
// ============================================================================

const DetailRow = ({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) => {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
            <div className="flex-1">
                <p className="text-sm text-slate-400">{label}</p>
                <div className="mt-1 text-white">{value}</div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value }: { label: string; value: string }) => {
    return (
        <div className="p-4 rounded-xl bg-slate-800/50 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
        </div>
    );
};

const SettingToggle = ({
    icon,
    title,
    description,
    enabled,
    onChange,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}) => {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-medium text-white">{title}</h4>
                        <p className="text-sm text-slate-400 mt-0.5">{description}</p>
                    </div>
                    <Switch
                        checked={enabled}
                        onChange={onChange}
                        className={`
                            relative inline-flex h-6 w-11 items-center rounded-full
                            transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900
                            ${enabled ? 'bg-purple-600' : 'bg-slate-700'}
                        `}
                    >
                        <span
                            className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${enabled ? 'translate-x-6' : 'translate-x-1'}
                            `}
                        />
                    </Switch>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Helpers
// ============================================================================

const shortenAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};
