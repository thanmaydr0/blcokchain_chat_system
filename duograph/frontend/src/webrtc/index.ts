/**
 * WebRTC Module Exports
 * 
 * Central export point for WebRTC calling functionality.
 */

// ICE Manager
export {
    IceCandidateManager,
    FREE_STUN_SERVERS,
    FREE_TURN_SERVERS,
    getDefaultIceConfig,
    getRelayOnlyConfig,
    analyzeNetworkQuality,
    restartIce,
    shouldRestartIce,
    type IceServer,
    type IceConfig,
    type IceCandidate,
    type IceConnectionState,
    type IceGatheringState,
    type NetworkQuality,
} from './iceManager';

// Nostr Signaling
export {
    NostrSignaling,
    createNostrSignaling,
    generateGhostId,
    decodeGhostId,
    type NostrSignalingOptions,
    type SignalMessage,
    type SignalingState,
} from './nostrSignaling';

// Media Stream
export {
    getMediaDevices,
    getAudioInputDevices,
    getVideoInputDevices,
    getAudioOutputDevices,
    getLocalMediaStream,
    getAudioStream,
    getVideoStream,
    getScreenShareStream,
    stopStream,
    setAudioMuted,
    setVideoEnabled,
    getMediaState,
    replaceAudioTrack,
    replaceVideoTrack,
    createAudioLevelAnalyzer,
    attachStreamToVideo,
    detachStreamFromVideo,
    VIDEO_QUALITY_PRESETS,
    DEFAULT_AUDIO_SETTINGS,
    type MediaConstraints,
    type MediaDeviceInfo,
    type VideoQuality,
    type AudioSettings,
    type MediaState,
    type ScreenShareOptions,
} from './mediaStream';

// Peer Connection
export {
    PeerConnectionManager,
    createPeerConnectionManager,
    type CallType,
    type CallState,
    type CallConfig,
    type CallStats,
    type CallEventHandlers,
} from './peerConnection';
