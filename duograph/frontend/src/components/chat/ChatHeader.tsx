import { Phone, Video, MoreVertical, Shield, ArrowLeft } from 'lucide-react';
import type { User, PactStatus } from '../../types';

interface ChatHeaderProps {
    partner: User | null;
    pactStatus: PactStatus;
    onBack?: () => void;
    onVoiceCall?: () => void;
    onVideoCall?: () => void;
    onOpenMenu?: () => void;
}

export const ChatHeader = ({
    partner,
    pactStatus,
    onBack,
    onVoiceCall,
    onVideoCall,
    onOpenMenu,
}: ChatHeaderProps) => {
    const getStatusColor = (status: PactStatus) => {
        switch (status) {
            case 'active':
                return 'status-online';
            case 'pending':
                return 'status-connecting';
            default:
                return 'status-offline';
        }
    };

    const getStatusText = (status: PactStatus) => {
        switch (status) {
            case 'active':
                return 'Online';
            case 'pending':
                return 'Pending';
            case 'dissolved':
                return 'Disconnected';
            default:
                return 'Offline';
        }
    };

    return (
        <header className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-900/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
                {/* Back Button (mobile) */}
                {onBack && (
                    <button
                        onClick={onBack}
                        className="btn-ghost p-2 rounded-xl md:hidden"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}

                {/* Avatar */}
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center text-white font-medium">
                        {partner?.email?.[0]?.toUpperCase() || 'P'}
                    </div>
                    <span
                        className={`absolute bottom-0 right-0 ${getStatusColor(pactStatus)}`}
                    />
                </div>

                {/* Info */}
                <div>
                    <h2 className="font-semibold text-dark-100 flex items-center gap-2">
                        {partner?.email?.split('@')[0] || 'Partner'}
                        <Shield className="w-3.5 h-3.5 text-green-400" />
                    </h2>
                    <p className="text-xs text-dark-400">{getStatusText(pactStatus)}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                <button
                    onClick={onVoiceCall}
                    disabled={pactStatus !== 'active'}
                    className="btn-ghost p-2.5 rounded-xl text-dark-400 hover:text-dark-100 disabled:opacity-50"
                >
                    <Phone className="w-5 h-5" />
                </button>
                <button
                    onClick={onVideoCall}
                    disabled={pactStatus !== 'active'}
                    className="btn-ghost p-2.5 rounded-xl text-dark-400 hover:text-dark-100 disabled:opacity-50"
                >
                    <Video className="w-5 h-5" />
                </button>
                <button
                    onClick={onOpenMenu}
                    className="btn-ghost p-2.5 rounded-xl text-dark-400 hover:text-dark-100"
                >
                    <MoreVertical className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
};

export default ChatHeader;
