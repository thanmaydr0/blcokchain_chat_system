/**
 * Lock Screen Component
 * 
 * Biometric unlock overlay when app is locked
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Shield, Loader2, AlertCircle } from 'lucide-react';
import { useSecurityStore } from '../../store/securityStore';
import {
    authenticateWithBiometric,
    isBiometricAvailable,
    onLockStateChange,
} from '../../security';

interface LockScreenProps {
    appName?: string;
    onUnlock?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
    appName = 'DuoGraph',
    onUnlock,
}) => {
    const { lockState, setLockState, toggles } = useSecurityStore();
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [biometricAvailable, setBiometricAvailable] = useState(true);

    useEffect(() => {
        // Check biometric availability
        isBiometricAvailable().then(setBiometricAvailable);

        // Subscribe to lock state changes
        const unsubscribe = onLockStateChange((state) => {
            setLockState(state);
            if (state === 'unlocked') {
                onUnlock?.();
            }
        });

        return unsubscribe;
    }, [setLockState, onUnlock]);

    const handleUnlock = async () => {
        if (isAuthenticating) return;

        setIsAuthenticating(true);
        setError(null);

        try {
            const success = await authenticateWithBiometric();
            if (!success) {
                setError('Authentication failed. Please try again.');
            }
        } catch (err) {
            setError('Biometric authentication unavailable.');
        } finally {
            setIsAuthenticating(false);
        }
    };

    // Don't show lock screen if biometric is disabled or unlocked
    if (!toggles.biometricUnlock || lockState === 'unlocked') {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                className="lock-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div className="lock-content">
                    {/* App Logo */}
                    <motion.div
                        className="lock-logo"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Shield className="logo-icon" />
                    </motion.div>

                    {/* App Name */}
                    <motion.h1
                        className="lock-title"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        {appName}
                    </motion.h1>

                    <motion.p
                        className="lock-subtitle"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                    >
                        Tap to unlock with biometrics
                    </motion.p>

                    {/* Unlock Button */}
                    <motion.button
                        className={`unlock-button ${isAuthenticating ? 'authenticating' : ''}`}
                        onClick={handleUnlock}
                        disabled={isAuthenticating || !biometricAvailable}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {isAuthenticating ? (
                            <Loader2 className="icon spin" />
                        ) : (
                            <Fingerprint className="icon" />
                        )}
                        <span>
                            {isAuthenticating
                                ? 'Verifying...'
                                : biometricAvailable
                                    ? 'Unlock'
                                    : 'Biometrics Unavailable'}
                        </span>
                    </motion.button>

                    {/* Error Message */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                className="lock-error"
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -10, opacity: 0 }}
                            >
                                <AlertCircle className="icon" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <style>{`
                    .lock-screen {
                        position: fixed;
                        inset: 0;
                        z-index: 999999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                        backdrop-filter: blur(20px);
                    }

                    .lock-content {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        padding: 40px;
                    }

                    .lock-logo {
                        width: 80px;
                        height: 80px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                        border-radius: 24px;
                        margin-bottom: 24px;
                        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
                    }

                    .logo-icon {
                        width: 40px;
                        height: 40px;
                        color: white;
                    }

                    .lock-title {
                        font-size: 32px;
                        font-weight: 700;
                        color: white;
                        margin: 0 0 8px;
                        letter-spacing: -0.5px;
                    }

                    .lock-subtitle {
                        font-size: 16px;
                        color: rgba(255, 255, 255, 0.6);
                        margin: 0 0 40px;
                    }

                    .unlock-button {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 16px 32px;
                        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                        color: white;
                        border: none;
                        border-radius: 16px;
                        font-size: 18px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
                    }

                    .unlock-button:hover:not(:disabled) {
                        box-shadow: 0 8px 30px rgba(59, 130, 246, 0.5);
                    }

                    .unlock-button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }

                    .unlock-button .icon {
                        width: 24px;
                        height: 24px;
                    }

                    .unlock-button .icon.spin {
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }

                    .lock-error {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-top: 20px;
                        padding: 12px 20px;
                        background: rgba(239, 68, 68, 0.15);
                        border: 1px solid rgba(239, 68, 68, 0.3);
                        border-radius: 12px;
                        color: #fca5a5;
                        font-size: 14px;
                    }

                    .lock-error .icon {
                        width: 18px;
                        height: 18px;
                        color: #ef4444;
                    }
                `}</style>
            </motion.div>
        </AnimatePresence>
    );
};

export default LockScreen;
