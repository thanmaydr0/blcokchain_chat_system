import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
};

export const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => {
    return <Loader2 className={`animate-spin ${sizes[size]} ${className}`} />;
};

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen = ({ message = 'Loading...' }: LoadingScreenProps) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gradient-bg">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse-soft">
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
                <p className="text-dark-400 animate-pulse">{message}</p>
            </div>
        </div>
    );
};

export default LoadingSpinner;
