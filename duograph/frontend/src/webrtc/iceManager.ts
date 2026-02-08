/**
 * ICE Manager
 * 
 * NAT traversal and ICE candidate handling for WebRTC connections.
 * Uses free STUN servers and implements fallback strategies.
 */

// ============================================================================
// Types
// ============================================================================

export interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

export interface IceConfig {
    iceServers: IceServer[];
    iceCandidatePoolSize: number;
    iceTransportPolicy: RTCIceTransportPolicy;
}

export interface IceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment: string | null;
}

export type IceConnectionState =
    | 'new'
    | 'checking'
    | 'connected'
    | 'completed'
    | 'failed'
    | 'disconnected'
    | 'closed';

export type IceGatheringState = 'new' | 'gathering' | 'complete';

// ============================================================================
// Free STUN/TURN Servers
// ============================================================================

/**
 * List of free public STUN servers.
 * These help with NAT traversal for most network configurations.
 */
export const FREE_STUN_SERVERS: IceServer[] = [
    // Google STUN servers (most reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    // Additional free STUN servers for redundancy
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voip.blackberry.com:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
];

/**
 * Free TURN servers (limited availability).
 * TURN is needed for symmetric NAT environments.
 */
export const FREE_TURN_SERVERS: IceServer[] = [
    // OpenRelay TURN (free tier available)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

// ============================================================================
// ICE Configuration
// ============================================================================

/**
 * Get default ICE configuration.
 */
export const getDefaultIceConfig = (useTurn: boolean = true): IceConfig => {
    return {
        iceServers: [
            ...FREE_STUN_SERVERS,
            ...(useTurn ? FREE_TURN_SERVERS : []),
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // 'all' or 'relay'
    };
};

/**
 * Get relay-only configuration (forces TURN).
 * Use when direct connections consistently fail.
 */
export const getRelayOnlyConfig = (): IceConfig => {
    return {
        iceServers: FREE_TURN_SERVERS,
        iceCandidatePoolSize: 5,
        iceTransportPolicy: 'relay',
    };
};

// ============================================================================
// ICE Candidate Manager
// ============================================================================

export interface IceCandidateManagerOptions {
    onLocalCandidate: (candidate: IceCandidate) => void;
    onGatheringComplete: () => void;
    onConnectionStateChange: (state: IceConnectionState) => void;
    onError: (error: Error) => void;
}

export class IceCandidateManager {
    private peerConnection: RTCPeerConnection | null = null;
    private localCandidates: IceCandidate[] = [];
    private remoteCandidates: IceCandidate[] = [];
    private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
    private isRemoteDescriptionSet = false;
    private options: IceCandidateManagerOptions;

    constructor(options: IceCandidateManagerOptions) {
        this.options = options;
    }

    /**
     * Attach to a peer connection.
     */
    attach(peerConnection: RTCPeerConnection): void {
        this.peerConnection = peerConnection;
        this.localCandidates = [];
        this.remoteCandidates = [];
        this.pendingRemoteCandidates = [];
        this.isRemoteDescriptionSet = false;

        // Listen for local ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const candidate: IceCandidate = {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    usernameFragment: event.candidate.usernameFragment,
                };

                this.localCandidates.push(candidate);
                this.options.onLocalCandidate(candidate);
            }
        };

        // Listen for gathering state changes
        peerConnection.onicegatheringstatechange = () => {
            if (peerConnection.iceGatheringState === 'complete') {
                this.options.onGatheringComplete();
            }
        };

        // Listen for connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            this.options.onConnectionStateChange(
                peerConnection.iceConnectionState as IceConnectionState
            );
        };
    }

    /**
     * Signal that the remote description is set.
     * Flushes any pending remote candidates.
     */
    async onRemoteDescriptionSet(): Promise<void> {
        this.isRemoteDescriptionSet = true;

        // Add any pending remote candidates
        for (const candidate of this.pendingRemoteCandidates) {
            await this.addRemoteCandidateInternal(candidate);
        }
        this.pendingRemoteCandidates = [];
    }

    /**
     * Add a remote ICE candidate.
     */
    async addRemoteCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
        if (!this.isRemoteDescriptionSet) {
            // Queue candidate until remote description is set
            this.pendingRemoteCandidates.push(candidateInit);
            return;
        }

        await this.addRemoteCandidateInternal(candidateInit);
    }

    private async addRemoteCandidateInternal(candidateInit: RTCIceCandidateInit): Promise<void> {
        if (!this.peerConnection) {
            this.options.onError(new Error('No peer connection attached'));
            return;
        }

        try {
            const candidate = new RTCIceCandidate(candidateInit);
            await this.peerConnection.addIceCandidate(candidate);

            this.remoteCandidates.push({
                candidate: candidateInit.candidate || '',
                sdpMid: candidateInit.sdpMid || null,
                sdpMLineIndex: candidateInit.sdpMLineIndex ?? null,
                usernameFragment: null,
            });
        } catch (error) {
            // Ignore errors for candidates received before offer/answer
            console.warn('Failed to add ICE candidate:', error);
        }
    }

    /**
     * Get all gathered local candidates.
     */
    getLocalCandidates(): IceCandidate[] {
        return [...this.localCandidates];
    }

    /**
     * Get all remote candidates.
     */
    getRemoteCandidates(): IceCandidate[] {
        return [...this.remoteCandidates];
    }

    /**
     * Detach from peer connection.
     */
    detach(): void {
        if (this.peerConnection) {
            this.peerConnection.onicecandidate = null;
            this.peerConnection.onicegatheringstatechange = null;
            this.peerConnection.oniceconnectionstatechange = null;
        }
        this.peerConnection = null;
    }
}

// ============================================================================
// Network Quality Detection
// ============================================================================

export interface NetworkQuality {
    rtt: number;           // Round-trip time in ms
    jitter: number;        // Jitter in ms
    packetLoss: number;    // Packet loss percentage
    bandwidth: number;     // Estimated bandwidth in kbps
    quality: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Analyze network quality from WebRTC stats.
 */
export const analyzeNetworkQuality = async (
    peerConnection: RTCPeerConnection
): Promise<NetworkQuality | null> => {
    try {
        const stats = await peerConnection.getStats();

        let rtt = 0;
        let jitter = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let bytesReceived = 0;
        let timestamp = 0;

        stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                rtt = report.currentRoundTripTime * 1000 || 0;
            }

            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                jitter = report.jitter * 1000 || 0;
                packetsLost = report.packetsLost || 0;
                packetsReceived = report.packetsReceived || 0;
            }

            if (report.type === 'inbound-rtp') {
                bytesReceived = report.bytesReceived || 0;
                timestamp = report.timestamp || 0;
            }
        });

        const totalPackets = packetsLost + packetsReceived;
        const packetLoss = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

        // Rough bandwidth estimate (would need multiple samples for accuracy)
        const bandwidth = bytesReceived > 0 && timestamp > 0
            ? (bytesReceived * 8) / (timestamp / 1000) / 1000
            : 0;

        // Determine quality level
        let quality: NetworkQuality['quality'] = 'excellent';
        if (rtt > 300 || packetLoss > 5 || jitter > 50) {
            quality = 'poor';
        } else if (rtt > 150 || packetLoss > 2 || jitter > 30) {
            quality = 'fair';
        } else if (rtt > 75 || packetLoss > 0.5 || jitter > 15) {
            quality = 'good';
        }

        return {
            rtt,
            jitter,
            packetLoss,
            bandwidth,
            quality,
        };
    } catch {
        return null;
    }
};

// ============================================================================
// ICE Restart Helpers
// ============================================================================

/**
 * Check if ICE restart is needed based on connection state.
 */
export const shouldRestartIce = (state: IceConnectionState): boolean => {
    return state === 'failed' || state === 'disconnected';
};

/**
 * Trigger ICE restart on a peer connection.
 */
export const restartIce = async (
    peerConnection: RTCPeerConnection
): Promise<RTCSessionDescriptionInit | null> => {
    try {
        const offer = await peerConnection.createOffer({ iceRestart: true });
        await peerConnection.setLocalDescription(offer);
        return offer;
    } catch (error) {
        console.error('Failed to restart ICE:', error);
        return null;
    }
};
