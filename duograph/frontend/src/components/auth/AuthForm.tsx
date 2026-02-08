import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield } from 'lucide-react';
import { signUp, signIn } from '../../lib/supabase';
import { useAuthStore } from '../../store';

interface AuthFormProps {
    onSuccess?: () => void;
}

export const AuthForm = ({ onSuccess }: AuthFormProps) => {
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
    });

    const { setUser } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (!isLogin && formData.password !== formData.confirmPassword) {
                throw new Error('Passwords do not match');
            }

            const { data, error: authError } = isLogin
                ? await signIn(formData.email, formData.password)
                : await signUp(formData.email, formData.password);

            if (authError) throw authError;

            if (data?.user) {
                setUser({
                    id: data.user.id,
                    email: data.user.email || '',
                    createdAt: data.user.created_at || new Date().toISOString(),
                });
                onSuccess?.();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4">
                    <Shield className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gradient mb-2">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h1>
                <p className="text-dark-400">
                    {isLogin
                        ? 'Sign in to your encrypted chat'
                        : 'Join the decentralized conversation'}
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                        type="email"
                        name="email"
                        placeholder="Email address"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="input-field pl-12"
                        required
                    />
                </div>

                {/* Password */}
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="input-field pl-12 pr-12"
                        required
                        minLength={8}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                    >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>

                {/* Confirm Password (Sign Up only) */}
                {!isLogin && (
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            placeholder="Confirm password"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            className="input-field pl-12"
                            required
                            minLength={8}
                        />
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            {isLogin ? 'Sign In' : 'Create Account'}
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            {/* Toggle */}
            <div className="mt-6 text-center">
                <p className="text-dark-400">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null);
                        }}
                        className="ml-2 text-duo-400 hover:text-duo-300 font-medium"
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>

            {/* Security Notice */}
            <div className="mt-8 p-4 rounded-xl bg-dark-800/30 border border-dark-700/50">
                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-dark-200">End-to-End Encrypted</p>
                        <p className="text-xs text-dark-500 mt-1">
                            Your messages are encrypted with keys stored only on your device.
                            We can never read your conversations.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthForm;
