/**
 * WebRTC utilities for peer-to-peer audio/video calls
 * Uses simple-peer for easier WebRTC management
 */

import Peer from 'simple-peer';
import type { Instance as PeerInstance, SignalData } from 'simple-peer';

// ICE server configuration for NAT traversal
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

export interface CallOptions {
    audio: boolean;
    video: boolean;
}

export type SignalHandler = (signal: SignalData) => void;
export type StreamHandler = (stream: MediaStream) => void;
export type ErrorHandler = (error: Error) => void;

export interface PeerConnection {
    peer: PeerInstance;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isInitiator: boolean;
    isConnected: boolean;
}

// Get user media stream
export const getUserMedia = async (options: CallOptions): Promise<MediaStream> => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: options.audio,
            video: options.video
                ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                }
                : false,
        });
        return stream;
    } catch (error) {
        console.error('Failed to get user media:', error);
        throw error;
    }
};

// Stop all tracks in a stream
export const stopStream = (stream: MediaStream | null): void => {
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
    }
};

// Create a new peer connection
export const createPeer = (
    isInitiator: boolean,
    stream: MediaStream | null,
    onSignal: SignalHandler,
    onStream: StreamHandler,
    onConnect: () => void,
    onClose: () => void,
    onError: ErrorHandler
): PeerInstance => {
    const peer = new Peer({
        initiator: isInitiator,
        trickle: true,
        stream: stream || undefined,
        config: {
            iceServers: ICE_SERVERS,
        },
    });

    peer.on('signal', onSignal);
    peer.on('stream', onStream);
    peer.on('connect', onConnect);
    peer.on('close', onClose);
    peer.on('error', onError);

    return peer;
};

// Signal to peer (for signaling exchange)
export const signalPeer = (peer: PeerInstance, signal: SignalData): void => {
    try {
        peer.signal(signal);
    } catch (error) {
        console.error('Failed to signal peer:', error);
    }
};

// Send data through peer connection
export const sendData = (peer: PeerInstance, data: string): void => {
    if (peer.connected) {
        peer.send(data);
    }
};

// Destroy peer connection
export const destroyPeer = (peer: PeerInstance | null): void => {
    if (peer) {
        try {
            peer.destroy();
        } catch (error) {
            console.error('Error destroying peer:', error);
        }
    }
};

// Toggle audio track
export const toggleAudio = (stream: MediaStream | null, enabled: boolean): void => {
    if (stream) {
        stream.getAudioTracks().forEach((track) => {
            track.enabled = enabled;
        });
    }
};

// Toggle video track
export const toggleVideo = (stream: MediaStream | null, enabled: boolean): void => {
    if (stream) {
        stream.getVideoTracks().forEach((track) => {
            track.enabled = enabled;
        });
    }
};

// Get screen share stream
export const getScreenShare = async (): Promise<MediaStream> => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
            },
            audio: true,
        });
        return stream;
    } catch (error) {
        console.error('Failed to get screen share:', error);
        throw error;
    }
};

// Replace video track (for screen sharing)
export const replaceVideoTrack = (
    peer: PeerInstance,
    oldStream: MediaStream,
    newTrack: MediaStreamTrack
): void => {
    const oldTrack = oldStream.getVideoTracks()[0];
    if (oldTrack && 'replaceTrack' in peer) {
        (peer as { replaceTrack: (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream) => void }).replaceTrack(oldTrack, newTrack, oldStream);
    }
};

// Check if WebRTC is supported
export const isWebRTCSupported = (): boolean => {
    return (
        typeof RTCPeerConnection !== 'undefined' &&
        typeof navigator.mediaDevices !== 'undefined' &&
        typeof navigator.mediaDevices.getUserMedia !== 'undefined'
    );
};

// Get audio/video devices
export const getMediaDevices = async (): Promise<{
    audioInputs: MediaDeviceInfo[];
    audioOutputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
}> => {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return {
        audioInputs: devices.filter((d) => d.kind === 'audioinput'),
        audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
        videoInputs: devices.filter((d) => d.kind === 'videoinput'),
    };
};
