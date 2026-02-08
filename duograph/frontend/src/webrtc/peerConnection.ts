/**
 * Peer Connection Module
 * 
 * WebRTC connection management with call controls.
 * Integrates Nostr signaling, ICE handling, and media streams.
 */

import {
    getDefaultIceConfig,
    IceCandidateManager,
    analyzeNetworkQuality,
    restartIce,
    shouldRestartIce,
    type IceConnectionState,
    type NetworkQuality,
} from './iceManager';
import {
    NostrSignaling,
    createNostrSignaling,
} from './nostrSignaling';
import {
    getLocalMediaStream,
    stopStream,
    setAudioMuted,
    setVideoEnabled,
    getScreenShareStream,
    type MediaState,
    type VideoQuality,
    VIDEO_QUALITY_PRESETS,
} from './mediaStream';

// ============================================================================
// Types
// ============================================================================

export type CallType = 'audio' | 'video';

export type CallState =
    | 'idle'
    | 'connecting'
    | 'ringing'
    | 'connected'
    | 'reconnecting'
    | 'ended'
    | 'failed';

export interface CallConfig {
    pactId: string;
    callType: CallType;
    videoQuality?: VideoQuality;
}

export interface CallStats {
    duration: number;
    networkQuality: NetworkQuality | null;
    bytesReceived: number;
    bytesSent: number;
}

export interface CallEventHandlers {
    onStateChange: (state: CallState) => void;
    onRemoteStream: (stream: MediaStream) => void;
    onLocalStream: (stream: MediaStream) => void;
    onNetworkQualityChange: (quality: NetworkQuality) => void;
    onError: (error: Error) => void;
    onIncomingCall: (fromGhostId: string, callType: CallType) => void;
}

// ============================================================================
// Peer Connection Manager
// ============================================================================

export class PeerConnectionManager {
    private peerConnection: RTCPeerConnection | null = null;
    private signaling: NostrSignaling | null = null;
    private iceManager: IceCandidateManager | null = null;

    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private screenStream: MediaStream | null = null;

    private callState: CallState = 'idle';
    private pactId: string = '';
    private remoteGhostId: string = '';

    private callStartTime: number = 0;
    private qualityCheckInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;

    private handlers: CallEventHandlers;

    constructor(handlers: CallEventHandlers) {
        this.handlers = handlers;
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Get current call state.
     */
    getState(): CallState {
        return this.callState;
    }

    /**
     * Get local media state.
     */
    getMediaState(): MediaState {
        const audioTracks = this.localStream?.getAudioTracks() || [];
        const videoTracks = this.localStream?.getVideoTracks() || [];

        return {
            hasAudio: audioTracks.length > 0,
            hasVideo: videoTracks.length > 0,
            audioMuted: audioTracks.length === 0 || !audioTracks[0].enabled,
            videoMuted: videoTracks.length === 0 || !videoTracks[0].enabled,
            isScreenSharing: this.screenStream !== null && this.screenStream.active,
        };
    }

    /**
     * Get call statistics.
     */
    async getStats(): Promise<CallStats> {
        const duration = this.callStartTime > 0
            ? Date.now() - this.callStartTime
            : 0;

        let networkQuality: NetworkQuality | null = null;
        let bytesReceived = 0;
        let bytesSent = 0;

        if (this.peerConnection) {
            networkQuality = await analyzeNetworkQuality(this.peerConnection);

            const stats = await this.peerConnection.getStats();
            stats.forEach((report) => {
                if (report.type === 'inbound-rtp') {
                    bytesReceived += report.bytesReceived || 0;
                }
                if (report.type === 'outbound-rtp') {
                    bytesSent += report.bytesSent || 0;
                }
            });
        }

        return { duration, networkQuality, bytesReceived, bytesSent };
    }

    // ========================================================================
    // Call Initiation
    // ========================================================================

    /**
     * Start a call to the pact partner.
     */
    async startCall(config: CallConfig): Promise<boolean> {
        if (this.callState !== 'idle') {
            return false;
        }

        this.pactId = config.pactId;
        this.setState('connecting');

        try {
            // Get local media
            this.localStream = await getLocalMediaStream({
                audioOnly: config.callType === 'audio',
                videoQuality: config.videoQuality || VIDEO_QUALITY_PRESETS.medium,
            });

            if (!this.localStream) {
                throw new Error('Failed to get local media');
            }

            this.handlers.onLocalStream(this.localStream);

            // Setup signaling
            await this.setupSignaling();

            // Create peer connection
            this.createPeerConnection();

            // Add local tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            // Create and send offer
            const offer = await this.peerConnection!.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: config.callType === 'video',
            });

            await this.peerConnection!.setLocalDescription(offer);

            // Wait for remote ghost ID from answer or send broadcast
            // For now, send to pactId as target (partner will filter)
            await this.signaling!.sendOffer(offer, this.pactId);

            this.setState('ringing');
            return true;

        } catch (error) {
            this.handleError(error instanceof Error ? error : new Error('Failed to start call'));
            return false;
        }
    }

    /**
     * Answer an incoming call.
     */
    async answerCall(
        fromGhostId: string,
        offer: RTCSessionDescriptionInit,
        callType: CallType
    ): Promise<boolean> {
        if (this.callState !== 'idle' && this.callState !== 'ringing') {
            return false;
        }

        this.remoteGhostId = fromGhostId;
        this.setState('connecting');

        try {
            // Get local media
            this.localStream = await getLocalMediaStream({
                audioOnly: callType === 'audio',
                videoQuality: VIDEO_QUALITY_PRESETS.medium,
            });

            if (!this.localStream) {
                throw new Error('Failed to get local media');
            }

            this.handlers.onLocalStream(this.localStream);

            // Ensure signaling is setup
            if (!this.signaling) {
                await this.setupSignaling();
            }

            // Create peer connection
            this.createPeerConnection();

            // Set remote description
            await this.peerConnection!.setRemoteDescription(offer);
            this.iceManager!.onRemoteDescriptionSet();

            // Add local tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            // Create and send answer
            const answer = await this.peerConnection!.createAnswer();
            await this.peerConnection!.setLocalDescription(answer);

            await this.signaling!.sendAnswer(answer, fromGhostId);

            return true;

        } catch (error) {
            this.handleError(error instanceof Error ? error : new Error('Failed to answer call'));
            return false;
        }
    }

    /**
     * End the current call.
     */
    endCall(): void {
        // Send hangup signal
        if (this.signaling && this.remoteGhostId) {
            this.signaling.sendHangup(this.remoteGhostId);
        }

        this.cleanup();
        this.setState('ended');
    }

    /**
     * Reject an incoming call.
     */
    rejectCall(): void {
        if (this.signaling && this.remoteGhostId) {
            this.signaling.sendHangup(this.remoteGhostId);
        }

        this.cleanup();
        this.setState('idle');
    }

    // ========================================================================
    // Call Controls
    // ========================================================================

    /**
     * Toggle audio mute.
     */
    toggleAudioMute(): boolean {
        if (!this.localStream) return false;

        const currentState = this.getMediaState();
        setAudioMuted(this.localStream, !currentState.audioMuted);
        return !currentState.audioMuted;
    }

    /**
     * Toggle video on/off.
     */
    toggleVideo(): boolean {
        if (!this.localStream) return false;

        const currentState = this.getMediaState();
        setVideoEnabled(this.localStream, currentState.videoMuted);
        return currentState.videoMuted;
    }

    /**
     * Start screen sharing.
     */
    async startScreenShare(): Promise<boolean> {
        if (!this.peerConnection) return false;

        try {
            this.screenStream = await getScreenShareStream();
            if (!this.screenStream) return false;

            const videoTrack = this.screenStream.getVideoTracks()[0];

            // Replace video track
            const sender = this.peerConnection.getSenders().find(s =>
                s.track?.kind === 'video'
            );

            if (sender) {
                await sender.replaceTrack(videoTrack);
            } else {
                this.peerConnection.addTrack(videoTrack, this.screenStream);
            }

            // Handle screen share end
            videoTrack.onended = () => {
                this.stopScreenShare();
            };

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Stop screen sharing.
     */
    async stopScreenShare(): Promise<void> {
        if (!this.screenStream || !this.peerConnection || !this.localStream) return;

        stopStream(this.screenStream);
        this.screenStream = null;

        // Restore camera track
        const cameraTrack = this.localStream.getVideoTracks()[0];
        if (cameraTrack) {
            const sender = this.peerConnection.getSenders().find(s =>
                s.track?.kind === 'video'
            );

            if (sender) {
                await sender.replaceTrack(cameraTrack);
            }
        }
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    private setState(state: CallState): void {
        this.callState = state;
        this.handlers.onStateChange(state);

        if (state === 'connected' && this.callStartTime === 0) {
            this.callStartTime = Date.now();
            this.startQualityMonitoring();
        }
    }

    private async setupSignaling(): Promise<void> {
        const { signaling } = createNostrSignaling(this.pactId, {
            onOffer: (offer, fromGhostId) => {
                this.handleIncomingOffer(offer, fromGhostId);
            },
            onAnswer: (answer, fromGhostId) => {
                this.handleAnswer(answer, fromGhostId);
            },
            onIceCandidate: (candidate) => {
                this.handleRemoteIceCandidate(candidate);
            },
            onError: (error) => {
                this.handleError(error);
            },
            onConnected: () => {
                console.log('Signaling connected');
            },
        });

        this.signaling = signaling;
        // ghostId stored for potential future use (e.g., displaying to user)

        await this.signaling.connect();
    }

    private createPeerConnection(): void {
        const config = getDefaultIceConfig();

        this.peerConnection = new RTCPeerConnection(config);

        // Setup ICE manager
        this.iceManager = new IceCandidateManager({
            onLocalCandidate: (candidate) => {
                if (this.signaling && this.remoteGhostId) {
                    this.signaling.sendIceCandidate(candidate, this.remoteGhostId);
                }
            },
            onGatheringComplete: () => {
                console.log('ICE gathering complete');
            },
            onConnectionStateChange: (state) => {
                this.handleIceConnectionStateChange(state);
            },
            onError: (error) => {
                this.handleError(error);
            },
        });

        this.iceManager.attach(this.peerConnection);

        // Handle remote tracks
        this.peerConnection.ontrack = (event) => {
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }

            event.streams[0].getTracks().forEach(track => {
                this.remoteStream!.addTrack(track);
            });

            this.handlers.onRemoteStream(this.remoteStream);
        };

        // Handle connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection?.connectionState;

            if (state === 'connected') {
                this.reconnectAttempts = 0;
                this.setState('connected');
            } else if (state === 'failed') {
                this.handleConnectionFailure();
            }
        };
    }

    private handleIncomingOffer(offer: RTCSessionDescriptionInit, fromGhostId: string): void {
        // Determine call type from SDP
        const hasVideo = offer.sdp?.includes('m=video');
        const callType: CallType = hasVideo ? 'video' : 'audio';

        this.remoteGhostId = fromGhostId;
        this.handlers.onIncomingCall(fromGhostId, callType);
    }

    private async handleAnswer(answer: RTCSessionDescriptionInit, fromGhostId: string): Promise<void> {
        if (!this.peerConnection) return;

        this.remoteGhostId = fromGhostId;

        try {
            await this.peerConnection.setRemoteDescription(answer);
            this.iceManager?.onRemoteDescriptionSet();
        } catch (error) {
            this.handleError(error instanceof Error ? error : new Error('Failed to set remote description'));
        }
    }

    private async handleRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (this.iceManager) {
            await this.iceManager.addRemoteCandidate(candidate);
        }
    }

    private handleIceConnectionStateChange(state: IceConnectionState): void {
        if (shouldRestartIce(state) && this.peerConnection) {
            this.attemptReconnect();
        }
    }

    private async handleConnectionFailure(): Promise<void> {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            await this.attemptReconnect();
        } else {
            this.setState('failed');
            this.cleanup();
        }
    }

    private async attemptReconnect(): Promise<void> {
        if (!this.peerConnection || !this.signaling) return;

        this.reconnectAttempts++;
        this.setState('reconnecting');

        const offer = await restartIce(this.peerConnection);
        if (offer && this.remoteGhostId) {
            await this.signaling.sendOffer(offer, this.remoteGhostId);
        }
    }

    private startQualityMonitoring(): void {
        this.qualityCheckInterval = setInterval(async () => {
            if (this.peerConnection) {
                const quality = await analyzeNetworkQuality(this.peerConnection);
                if (quality) {
                    this.handlers.onNetworkQualityChange(quality);
                }
            }
        }, 5000);
    }

    private handleError(error: Error): void {
        console.error('Call error:', error);
        this.handlers.onError(error);
    }

    private cleanup(): void {
        // Stop quality monitoring
        if (this.qualityCheckInterval) {
            clearInterval(this.qualityCheckInterval);
            this.qualityCheckInterval = null;
        }

        // Cleanup streams
        stopStream(this.localStream);
        stopStream(this.screenStream);
        this.localStream = null;
        this.remoteStream = null;
        this.screenStream = null;

        // Cleanup ICE manager
        this.iceManager?.detach();
        this.iceManager = null;

        // Cleanup peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Cleanup signaling
        this.signaling?.disconnect();
        this.signaling = null;

        // Reset state
        this.callStartTime = 0;
        this.reconnectAttempts = 0;
        this.remoteGhostId = '';
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new peer connection manager.
 */
export const createPeerConnectionManager = (
    handlers: CallEventHandlers
): PeerConnectionManager => {
    return new PeerConnectionManager(handlers);
};
