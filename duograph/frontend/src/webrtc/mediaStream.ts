/**
 * Media Stream Module
 * 
 * Audio/video capture, rendering, and screen sharing.
 */

// ============================================================================
// Types
// ============================================================================

export interface MediaConstraints {
    audio: boolean | MediaTrackConstraints;
    video: boolean | MediaTrackConstraints;
}

export interface MediaDeviceInfo {
    deviceId: string;
    label: string;
    kind: MediaDeviceKind;
}

export interface VideoQuality {
    width: number;
    height: number;
    frameRate: number;
}

export interface AudioSettings {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
}

export type MediaState = {
    hasAudio: boolean;
    hasVideo: boolean;
    audioMuted: boolean;
    videoMuted: boolean;
    isScreenSharing: boolean;
};

// ============================================================================
// Constants
// ============================================================================

export const VIDEO_QUALITY_PRESETS: Record<string, VideoQuality> = {
    low: { width: 320, height: 240, frameRate: 15 },
    medium: { width: 640, height: 480, frameRate: 24 },
    high: { width: 1280, height: 720, frameRate: 30 },
    hd: { width: 1920, height: 1080, frameRate: 30 },
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

// ============================================================================
// Device Enumeration
// ============================================================================

/**
 * Get available media devices.
 */
export const getMediaDevices = async (): Promise<MediaDeviceInfo[]> => {
    try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            .then(stream => stream.getTracks().forEach(t => t.stop()))
            .catch(() => { });

        const devices = await navigator.mediaDevices.enumerateDevices();

        return devices.map(device => ({
            deviceId: device.deviceId,
            label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
            kind: device.kind,
        }));
    } catch (error) {
        console.error('Failed to enumerate devices:', error);
        return [];
    }
};

/**
 * Get audio input devices.
 */
export const getAudioInputDevices = async (): Promise<MediaDeviceInfo[]> => {
    const devices = await getMediaDevices();
    return devices.filter(d => d.kind === 'audioinput');
};

/**
 * Get video input devices.
 */
export const getVideoInputDevices = async (): Promise<MediaDeviceInfo[]> => {
    const devices = await getMediaDevices();
    return devices.filter(d => d.kind === 'videoinput');
};

/**
 * Get audio output devices.
 */
export const getAudioOutputDevices = async (): Promise<MediaDeviceInfo[]> => {
    const devices = await getMediaDevices();
    return devices.filter(d => d.kind === 'audiooutput');
};

// ============================================================================
// Media Stream Acquisition
// ============================================================================

/**
 * Build media constraints from options.
 */
const buildConstraints = (
    options: {
        audioDeviceId?: string;
        videoDeviceId?: string;
        videoQuality?: VideoQuality;
        audioSettings?: AudioSettings;
        audioOnly?: boolean;
        videoOnly?: boolean;
    }
): MediaConstraints => {
    const { audioDeviceId, videoDeviceId, videoQuality, audioSettings, audioOnly, videoOnly } = options;

    const quality = videoQuality || VIDEO_QUALITY_PRESETS.medium;
    const audio = audioSettings || DEFAULT_AUDIO_SETTINGS;

    return {
        audio: videoOnly ? false : {
            deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
            echoCancellation: audio.echoCancellation,
            noiseSuppression: audio.noiseSuppression,
            autoGainControl: audio.autoGainControl,
        },
        video: audioOnly ? false : {
            deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
            width: { ideal: quality.width },
            height: { ideal: quality.height },
            frameRate: { ideal: quality.frameRate },
        },
    };
};

/**
 * Get local media stream (camera/microphone).
 */
export const getLocalMediaStream = async (
    options: {
        audioDeviceId?: string;
        videoDeviceId?: string;
        videoQuality?: VideoQuality;
        audioSettings?: AudioSettings;
        audioOnly?: boolean;
        videoOnly?: boolean;
    } = {}
): Promise<MediaStream | null> => {
    try {
        const constraints = buildConstraints(options);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
    } catch (error) {
        console.error('Failed to get local media:', error);

        // Try audio only as fallback
        if (!options.audioOnly && !options.videoOnly) {
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false,
                });
                return audioStream;
            } catch {
                return null;
            }
        }

        return null;
    }
};

/**
 * Get audio-only stream.
 */
export const getAudioStream = async (
    deviceId?: string,
    settings?: AudioSettings
): Promise<MediaStream | null> => {
    return getLocalMediaStream({
        audioDeviceId: deviceId,
        audioSettings: settings,
        audioOnly: true,
    });
};

/**
 * Get video-only stream.
 */
export const getVideoStream = async (
    deviceId?: string,
    quality?: VideoQuality
): Promise<MediaStream | null> => {
    return getLocalMediaStream({
        videoDeviceId: deviceId,
        videoQuality: quality,
        videoOnly: true,
    });
};

// ============================================================================
// Screen Sharing
// ============================================================================

export interface ScreenShareOptions {
    video: boolean | {
        displaySurface?: 'monitor' | 'window' | 'browser';
        cursor?: 'always' | 'motion' | 'never';
    };
    audio: boolean | {
        suppressLocalAudioPlayback?: boolean;
    };
}

/**
 * Get screen sharing stream.
 */
export const getScreenShareStream = async (
    options: ScreenShareOptions = { video: true, audio: false }
): Promise<MediaStream | null> => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: options.video || true,
            audio: typeof options.audio === 'boolean' ? options.audio : !!options.audio,
        });

        return stream;
    } catch (error) {
        console.error('Failed to get screen share:', error);
        return null;
    }
};

// ============================================================================
// Stream Management
// ============================================================================

/**
 * Stop all tracks in a stream.
 */
export const stopStream = (stream: MediaStream | null): void => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
};

/**
 * Mute/unmute audio tracks.
 */
export const setAudioMuted = (stream: MediaStream, muted: boolean): void => {
    stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
    });
};

/**
 * Enable/disable video tracks.
 */
export const setVideoEnabled = (stream: MediaStream, enabled: boolean): void => {
    stream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
    });
};

/**
 * Get current media state from stream.
 */
export const getMediaState = (
    stream: MediaStream | null,
    screenStream: MediaStream | null = null
): MediaState => {
    if (!stream) {
        return {
            hasAudio: false,
            hasVideo: false,
            audioMuted: true,
            videoMuted: true,
            isScreenSharing: false,
        };
    }

    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();

    return {
        hasAudio: audioTracks.length > 0,
        hasVideo: videoTracks.length > 0,
        audioMuted: audioTracks.length === 0 || !audioTracks[0].enabled,
        videoMuted: videoTracks.length === 0 || !videoTracks[0].enabled,
        isScreenSharing: screenStream !== null && screenStream.active,
    };
};

// ============================================================================
// Track Replacement
// ============================================================================

/**
 * Replace audio track in a stream.
 */
export const replaceAudioTrack = async (
    stream: MediaStream,
    newDeviceId: string
): Promise<boolean> => {
    try {
        const newStream = await getAudioStream(newDeviceId);
        if (!newStream) return false;

        const newTrack = newStream.getAudioTracks()[0];
        const oldTrack = stream.getAudioTracks()[0];

        if (oldTrack) {
            stream.removeTrack(oldTrack);
            oldTrack.stop();
        }

        stream.addTrack(newTrack);
        return true;
    } catch {
        return false;
    }
};

/**
 * Replace video track in a stream.
 */
export const replaceVideoTrack = async (
    stream: MediaStream,
    newDeviceId: string,
    quality?: VideoQuality
): Promise<boolean> => {
    try {
        const newStream = await getVideoStream(newDeviceId, quality);
        if (!newStream) return false;

        const newTrack = newStream.getVideoTracks()[0];
        const oldTrack = stream.getVideoTracks()[0];

        if (oldTrack) {
            stream.removeTrack(oldTrack);
            oldTrack.stop();
        }

        stream.addTrack(newTrack);
        return true;
    } catch {
        return false;
    }
};

// ============================================================================
// Audio Level Detection
// ============================================================================

export interface AudioLevelOptions {
    fftSize?: number;
    smoothingTimeConstant?: number;
}

/**
 * Create an audio level analyzer.
 */
export const createAudioLevelAnalyzer = (
    stream: MediaStream,
    options: AudioLevelOptions = {}
): { getLevel: () => number; stop: () => void } => {
    const { fftSize = 256, smoothingTimeConstant = 0.8 } = options;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothingTimeConstant;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const getLevel = (): number => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        return sum / dataArray.length / 255; // Normalized 0-1
    };

    const stop = (): void => {
        source.disconnect();
        audioContext.close();
    };

    return { getLevel, stop };
};

// ============================================================================
// Video Element Management
// ============================================================================

/**
 * Attach stream to video element.
 */
export const attachStreamToVideo = (
    videoElement: HTMLVideoElement,
    stream: MediaStream,
    options: { muted?: boolean; autoplay?: boolean } = {}
): void => {
    const { muted = false, autoplay = true } = options;

    videoElement.srcObject = stream;
    videoElement.muted = muted;

    if (autoplay) {
        videoElement.play().catch(console.error);
    }
};

/**
 * Detach stream from video element.
 */
export const detachStreamFromVideo = (videoElement: HTMLVideoElement): void => {
    videoElement.srcObject = null;
    videoElement.load();
};
