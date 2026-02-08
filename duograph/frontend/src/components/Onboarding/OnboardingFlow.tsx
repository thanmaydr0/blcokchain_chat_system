/**
 * Onboarding Flow Components
 * 
 * Welcome, wallet connection, key generation, and pact creation.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheckIcon,
    KeyIcon,
    LinkIcon,
    QrCodeIcon,
    ArrowRightIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/solid';
import { Button } from '../shared/Button';
import QRCode from 'qrcode';

// ============================================================================
// Types
// ============================================================================

export interface OnboardingProps {
    currentStep: number;
    onNextStep: () => void;
    onPrevStep: () => void;
    onComplete: () => void;

    // Wallet
    onConnectWallet: () => Promise<void>;
    walletAddress?: string;
    isConnecting: boolean;

    // Keys
    onGenerateKeys: () => Promise<void>;
    keysGenerated: boolean;
    keyGenerationProgress: number;

    // Invite
    inviteCode?: string;
    inviteQRUrl?: string;
    onGenerateInvite: () => Promise<void>;
    onScanInvite: () => void;

    // Accept
    onAcceptInvite: (code: string) => Promise<void>;
    pendingInvite?: { code: string; fromAddress: string };
}

// ============================================================================
// Main Onboarding Container
// ============================================================================


export const OnboardingFlow = ({
    currentStep,
    onNextStep,
    onPrevStep: _, // Required by interface but not currently used
    ...props
}: OnboardingProps) => {
    const steps = [
        { id: 0, title: 'Welcome', component: <WelcomeStep onNext={onNextStep} /> },
        { id: 1, title: 'Connect', component: <WalletStep {...props} onNext={onNextStep} /> },
        { id: 2, title: 'Keys', component: <KeysStep {...props} onNext={onNextStep} /> },
        { id: 3, title: 'Invite', component: <InviteStep {...props} /> },
    ];

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Progress Bar */}
            <div className="px-6 pt-6">
                <div className="flex items-center gap-2">
                    {steps.map((step, index) => (
                        <div key={step.id} className="flex-1">
                            <motion.div
                                className="h-1 rounded-full"
                                initial={{ scaleX: 0 }}
                                animate={{
                                    scaleX: index <= currentStep ? 1 : 0,
                                    backgroundColor: index <= currentStep ? '#A855F7' : '#334155',
                                }}
                                style={{ originX: 0 }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 flex items-center justify-center p-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="w-full max-w-md"
                    >
                        {steps[currentStep]?.component}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

// ============================================================================
// Step 1: Welcome
// ============================================================================

const WelcomeStep = ({ onNext }: { onNext: () => void }) => {
    return (
        <div className="text-center">
            {/* Logo/Icon */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.6 }}
                className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/30"
            >
                <ShieldCheckIcon className="w-12 h-12 text-white" />
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-8 text-3xl font-bold text-white"
            >
                Welcome to DuoGraph
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 text-slate-400 leading-relaxed"
            >
                The most private way to communicate. Create a <span className="text-purple-400 font-semibold">Binary Pact</span> —
                an encrypted channel between exactly two people, anchored on the blockchain.
            </motion.p>

            {/* Features */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8 space-y-3"
            >
                {[
                    'End-to-end encryption with Double Ratchet',
                    'Local-first: your data never leaves your device',
                    'Blockchain-verified message integrity',
                ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-left">
                        <CheckCircleIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm text-slate-300">{feature}</span>
                    </div>
                ))}
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-10"
            >
                <Button
                    size="lg"
                    fullWidth
                    onClick={onNext}
                    rightIcon={<ArrowRightIcon className="w-5 h-5" />}
                >
                    Get Started
                </Button>
            </motion.div>
        </div>
    );
};

// ============================================================================
// Step 2: Wallet Connection
// ============================================================================

const WalletStep = ({
    onConnectWallet,
    walletAddress,
    isConnecting,
    onNext,
}: {
    onConnectWallet: () => Promise<void>;
    walletAddress?: string;
    isConnecting: boolean;
    onNext: () => void;
}) => {
    const handleConnect = async () => {
        await onConnectWallet();
        if (walletAddress) {
            onNext();
        }
    };

    return (
        <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                <LinkIcon className="w-8 h-8 text-blue-400" />
            </div>

            <h2 className="mt-6 text-2xl font-bold text-white">
                Connect Your Wallet
            </h2>

            <p className="mt-3 text-slate-400">
                Your wallet address is your identity. No email or phone number needed.
            </p>

            {walletAddress ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
                >
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                        <CheckCircleIcon className="w-5 h-5" />
                        <span className="font-medium">Connected</span>
                    </div>
                    <p className="mt-2 font-mono text-sm text-slate-300">
                        {walletAddress}
                    </p>
                </motion.div>
            ) : (
                <div className="mt-8">
                    <Button
                        size="lg"
                        fullWidth
                        onClick={handleConnect}
                        isLoading={isConnecting}
                        leftIcon={
                            <svg className="w-5 h-5" viewBox="0 0 318.6 318.6">
                                <path fill="#E2761B" d="M274.1 35.5l-99.5 73.9L193 65.8z" />
                                <path fill="#E4761B" d="M44.4 35.5l98.7 74.6-17.5-44.3zm193.9 171.3l-26.5 40.6 56.7 15.6 16.3-55.3zm-204.4.9l16.2 55.3 56.7-15.6-26.5-40.6z" />
                            </svg>
                        }
                    >
                        Connect MetaMask
                    </Button>
                </div>
            )}

            {walletAddress && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6"
                >
                    <Button
                        size="lg"
                        fullWidth
                        onClick={onNext}
                        rightIcon={<ArrowRightIcon className="w-5 h-5" />}
                    >
                        Continue
                    </Button>
                </motion.div>
            )}
        </div>
    );
};

// ============================================================================
// Step 3: Key Generation
// ============================================================================

const KeysStep = ({
    onGenerateKeys,
    keysGenerated,
    keyGenerationProgress,
    onNext,
}: {
    onGenerateKeys: () => Promise<void>;
    keysGenerated: boolean;
    keyGenerationProgress: number;
    onNext: () => void;
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        await onGenerateKeys();
        setIsGenerating(false);
    };

    return (
        <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                <KeyIcon className="w-8 h-8 text-purple-400" />
            </div>

            <h2 className="mt-6 text-2xl font-bold text-white">
                Generate Encryption Keys
            </h2>

            <p className="mt-3 text-slate-400">
                Your keys are generated locally and never leave your device.
            </p>

            {isGenerating ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8"
                >
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${keyGenerationProgress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                    <p className="mt-3 text-sm text-slate-400">
                        Generating secure keys... {keyGenerationProgress}%
                    </p>
                </motion.div>
            ) : keysGenerated ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
                >
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                        <CheckCircleIcon className="w-5 h-5" />
                        <span className="font-medium">Keys Generated</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                        Your encryption keys are securely stored on this device
                    </p>
                </motion.div>
            ) : (
                <div className="mt-8">
                    <Button
                        size="lg"
                        fullWidth
                        onClick={handleGenerate}
                        leftIcon={<KeyIcon className="w-5 h-5" />}
                    >
                        Generate Keys
                    </Button>
                </div>
            )}

            {keysGenerated && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6"
                >
                    <Button
                        size="lg"
                        fullWidth
                        onClick={onNext}
                        rightIcon={<ArrowRightIcon className="w-5 h-5" />}
                    >
                        Continue
                    </Button>
                </motion.div>
            )}
        </div>
    );
};

// ============================================================================
// Step 4: Invite
// ============================================================================

const InviteStep = ({
    inviteCode,
    onGenerateInvite,
    onScanInvite,
    onComplete,
}: {
    inviteCode?: string;
    onGenerateInvite: () => Promise<void>;
    onScanInvite: () => void;
    onComplete: () => void;
}) => {
    const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
    const [qrDataUrl, setQrDataUrl] = useState<string>();

    const handleCreateInvite = async () => {
        setMode('create');
        await onGenerateInvite();

        if (inviteCode) {
            const url = await QRCode.toDataURL(inviteCode, {
                width: 200,
                color: { dark: '#6B46C1', light: '#0F172A' },
            });
            setQrDataUrl(url);
        }
    };

    if (mode === 'choose') {
        return (
            <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                    <QrCodeIcon className="w-8 h-8 text-emerald-400" />
                </div>

                <h2 className="mt-6 text-2xl font-bold text-white">
                    Create or Join a Pact
                </h2>

                <p className="mt-3 text-slate-400">
                    Start a new conversation or accept an invite from someone.
                </p>

                <div className="mt-8 space-y-3">
                    <Button
                        size="lg"
                        fullWidth
                        onClick={handleCreateInvite}
                    >
                        Create New Pact
                    </Button>

                    <Button
                        size="lg"
                        fullWidth
                        variant="ghost"
                        onClick={() => setMode('join')}
                    >
                        I Have an Invite
                    </Button>
                </div>
            </div>
        );
    }

    if (mode === 'create') {
        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white">
                    Share This Invite
                </h2>

                <p className="mt-3 text-slate-400">
                    Your partner needs to scan this QR code or enter the code.
                </p>

                {qrDataUrl && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-8 mx-auto p-4 bg-slate-800 rounded-2xl inline-block"
                    >
                        <img src={qrDataUrl} alt="Invite QR Code" className="rounded-lg" />
                    </motion.div>
                )}

                {inviteCode && (
                    <div className="mt-4">
                        <p className="text-sm text-slate-400 mb-2">Or share this code:</p>
                        <code className="block p-3 bg-slate-800 rounded-lg font-mono text-sm text-purple-400 break-all">
                            {inviteCode}
                        </code>
                    </div>
                )}

                <p className="mt-6 text-sm text-amber-400">
                    ⏳ Waiting for partner to accept...
                </p>
            </div>
        );
    }

    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-white">
                Enter Invite Code
            </h2>

            <p className="mt-3 text-slate-400">
                Paste the invite code you received.
            </p>

            <div className="mt-6">
                <Button size="lg" fullWidth onClick={onScanInvite}>
                    Scan QR Code
                </Button>
            </div>

            <div className="mt-4 flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-slate-500 text-sm">or</span>
                <div className="flex-1 h-px bg-slate-700" />
            </div>

            <div className="mt-4">
                <input
                    type="text"
                    placeholder="Paste invite code..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
            </div>

            <div className="mt-6">
                <Button size="lg" fullWidth onClick={onComplete}>
                    Join Pact
                </Button>
            </div>
        </div>
    );
};

// ============================================================================
// Exports
// ============================================================================

export { WelcomeStep, WalletStep, KeysStep, InviteStep };
