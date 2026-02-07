import { Shield, Key, Lock, Zap } from 'lucide-react';
import { AuthForm } from '../components/auth/AuthForm';

export const AuthPage = () => {
    return (
        <div className="min-h-screen flex gradient-bg">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-duo-500/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl" />
                </div>

                {/* Content */}
                <div className="relative z-10 max-w-lg">
                    {/* Logo */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-duo-500/25">
                            <svg
                                className="w-8 h-8 text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-gradient">DuoGraph</h1>
                            <p className="text-dark-400">Two-Person Encrypted Chat</p>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-duo-500/10 flex items-center justify-center flex-shrink-0">
                                <Lock className="w-6 h-6 text-duo-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-dark-100 mb-1">
                                    End-to-End Encryption
                                </h3>
                                <p className="text-sm text-dark-400">
                                    Messages encrypted with Signal's Double Ratchet algorithm. Only you
                                    and your partner can read them.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex items-center justify-center flex-shrink-0">
                                <Key className="w-6 h-6 text-accent-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-dark-100 mb-1">
                                    Hardware-Bound Identity
                                </h3>
                                <p className="text-sm text-dark-400">
                                    Keys stored in your browser's secure storage. Your identity never
                                    leaves your device.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                <Shield className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-dark-100 mb-1">
                                    Blockchain Anchored
                                </h3>
                                <p className="text-sm text-dark-400">
                                    Binary Pact Protocol ensures only 2 participants can ever join a
                                    conversation.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                                <Zap className="w-6 h-6 text-yellow-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-dark-100 mb-1">
                                    Zero Gas Fees
                                </h3>
                                <p className="text-sm text-dark-400">
                                    Built on Base Sepolia with account abstraction. No wallet setup
                                    required to start.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <AuthForm />
            </div>
        </div>
    );
};

export default AuthPage;
