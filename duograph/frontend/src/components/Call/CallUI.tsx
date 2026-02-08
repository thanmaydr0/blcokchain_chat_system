/**
 * Video Call UI Component
 * 
 * Full-screen video/audio call interface.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MicrophoneIcon,
    VideoCameraIcon,
    PhoneXMarkIcon,
    ComputerDesktopIcon,
    SignalIcon,
} from '@heroicons/react/24/solid';
import {
    MicrophoneIcon as MicrophoneMutedIcon,
    VideoCameraSlashIcon,
} from '@heroicons/react/24/outline';
import { PrivacyBadge } from '../shared/PrivacyBadge';

// ============================================================================
// Types
// ============================================================================

export type CallState = 'connecting' | 'ringing' | 'connected' | 'reconnecting' | 'ended';
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface CallUIProps {
    callType: 'audio' | 'video';
    callState: CallState;
    partnerName: string;
    partnerAvatar?: string;
    duration: number;
    networkQuality: NetworkQuality;
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    localStream?: MediaStream;
    remoteStream?: MediaStream;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare: () => void;
    onEndCall: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const CallUI = ({
    callType,
    callState,
    partnerName,
    partnerAvatar,
    duration,
    networkQuality,
    isMuted,
    isVideoOff,
    isScreenSharing,
    localStream,
    remoteStream,
    onToggleMute,
    onToggleVideo,
    onToggleScreenShare,
    onEndCall,
}: CallUIProps) => {
    const [showControls, setShowControls] = useState(true);

    // Auto-hide controls after 5 seconds
    useEffect(() => {
        if (callState !== 'connected') return;

        const timer = setTimeout(() => {
            setShowControls(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, [callState, showControls]);

    const isVideoCall = callType === 'video';

    return (
        <motion.div
            className="fixed inset-0 z-50 bg-slate-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowControls(true)}
        >
            {/* Background - Remote Video or Avatar */}
            {isVideoCall && remoteStream && callState === 'connected' ? (
                <RemoteVideo stream={remoteStream} />
            ) : (
                <AudioCallBackground
                    name={partnerName}
                    avatar={partnerAvatar}
                    callState={callState}
                />
            )}

            {/* Local Video (Picture-in-Picture) */}
            {isVideoCall && localStream && !isVideoOff && callState === 'connected' && (
                <LocalVideo stream={localStream} />
            )}

            {/* Top Bar */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <PrivacyBadge status="secure" size="sm" />
                                <NetworkIndicator quality={networkQuality} />
                            </div>

                            {callState === 'connected' && (
                                <div className="text-white font-mono text-lg">
                                    {formatDuration(duration)}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Call Status Overlay */}
            {callState !== 'connected' && (
                <CallStatusOverlay
                    state={callState}
                    partnerName={partnerName}
                />
            )}

            {/* Bottom Controls */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent"
                    >
                        <div className="flex items-center justify-center gap-4">
                            {/* Mute */}
                            <ControlButton
                                icon={isMuted ? <MicrophoneMutedIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
                                isActive={!isMuted}
                                onClick={onToggleMute}
                                label={isMuted ? 'Unmute' : 'Mute'}
                            />

                            {/* Video Toggle */}
                            {isVideoCall && (
                                <ControlButton
                                    icon={isVideoOff ? <VideoCameraSlashIcon className="w-6 h-6" /> : <VideoCameraIcon className="w-6 h-6" />}
                                    isActive={!isVideoOff}
                                    onClick={onToggleVideo}
                                    label={isVideoOff ? 'Camera On' : 'Camera Off'}
                                />
                            )}

                            {/* Screen Share */}
                            {isVideoCall && (
                                <ControlButton
                                    icon={<ComputerDesktopIcon className="w-6 h-6" />}
                                    isActive={isScreenSharing}
                                    onClick={onToggleScreenShare}
                                    label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
                                />
                            )}

                            {/* End Call */}
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onEndCall}
                                className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50"
                            >
                                <PhoneXMarkIcon className="w-8 h-8" />
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ============================================================================
// Sub-Components
// ============================================================================

const RemoteVideo = ({ stream }: { stream: MediaStream }) => {
    return (
        <video
            ref={(el) => { if (el) el.srcObject = stream; }}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
        />
    );
};

const LocalVideo = ({ stream }: { stream: MediaStream }) => {
    return (
        <motion.div
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            className="absolute bottom-28 right-4 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700"
        >
            <video
                ref={(el) => { if (el) el.srcObject = stream; }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
            />
        </motion.div>
    );
};

const AudioCallBackground = ({
    name,
    avatar,
    callState,
}: {
    name: string;
    avatar?: string;
    callState: CallState;
}) => {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
            {/* Animated rings */}
            <div className="relative">
                {callState === 'ringing' && (
                    <>
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                className="absolute inset-0 rounded-full border-2 border-purple-500/30"
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 2 + i * 0.5, opacity: 0 }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.3,
                                }}
                                style={{
                                    width: 128,
                                    height: 128,
                                    marginLeft: -64,
                                    marginTop: -64,
                                }}
                            />
                        ))}
                    </>
                )}

                {/* Avatar */}
                <div className="relative z-10">
                    {avatar ? (
                        <img
                            src={avatar}
                            alt={name}
                            className="w-32 h-32 rounded-full"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-4xl font-bold">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            <h2 className="mt-6 text-2xl font-semibold text-white">{name}</h2>
        </div>
    );
};

const CallStatusOverlay = ({
    state,
    partnerName,
}: {
    state: CallState;
    partnerName: string;
}) => {
    const messages: Record<CallState, string> = {
        connecting: 'Connecting...',
        ringing: `Calling ${partnerName}...`,
        connected: '',
        reconnecting: 'Reconnecting...',
        ended: 'Call ended',
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
        >
            <div className="text-center">
                <p className="text-xl text-white/80">{messages[state]}</p>

                {(state === 'connecting' || state === 'reconnecting') && (
                    <div className="mt-4 flex justify-center gap-1">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                className="w-2 h-2 bg-purple-500 rounded-full"
                                animate={{ y: [0, -8, 0] }}
                                transition={{
                                    duration: 0.6,
                                    repeat: Infinity,
                                    delay: i * 0.15,
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const ControlButton = ({
    icon,
    isActive,
    onClick,
    label,
}: {
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    label: string;
}) => {
    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={`
                p-3 rounded-full transition-colors duration-200
                ${isActive
                    ? 'bg-slate-700/80 text-white'
                    : 'bg-slate-800/80 text-slate-400'
                }
            `}
            title={label}
        >
            {icon}
        </motion.button>
    );
};

const NetworkIndicator = ({ quality }: { quality: NetworkQuality }) => {
    const colors: Record<NetworkQuality, string> = {
        excellent: 'text-emerald-400',
        good: 'text-emerald-400',
        fair: 'text-amber-400',
        poor: 'text-red-400',
    };

    return (
        <div className={`flex items-center gap-1 ${colors[quality]}`}>
            <SignalIcon className="w-4 h-4" />
            <span className="text-xs capitalize">{quality}</span>
        </div>
    );
};

// ============================================================================
// Helpers
// ============================================================================

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
