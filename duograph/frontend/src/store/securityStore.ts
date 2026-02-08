/**
 * Security Store
 * 
 * Zustand store for security feature state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LockState } from '../security/biometric';
import type { AuditResult } from '../security/zkAudit';
import type { NetworkStatus } from '../security/antiSurveillance';

// Security feature toggles
export interface SecurityToggles {
    screenshotProtection: boolean;
    biometricUnlock: boolean;
    biometricPerMessage: boolean;
    zkAudit: boolean;
    disappearingMessages: boolean;
    antiSurveillance: boolean;
    dummyTraffic: boolean;
    deadManSwitch: boolean;
}

// Security state
export interface SecurityState {
    // Feature toggles
    toggles: SecurityToggles;

    // Lock state
    lockState: LockState;
    lastActivityTime: number;

    // Audit state
    latestAudit: AuditResult | null;
    auditInProgress: boolean;

    // Network status
    networkStatus: NetworkStatus | null;

    // Emergency state
    panicMode: boolean;
    duressMode: boolean;

    // Disappearing messages
    defaultDisappearTime: number; // 0 = off

    // Dead man's switch
    deadManDays: number;
    lastCheckIn: number;

    // Screenshot events
    screenshotAttempts: number;

    // Actions
    setToggle: (key: keyof SecurityToggles, value: boolean) => void;
    setAllToggles: (toggles: Partial<SecurityToggles>) => void;
    setLockState: (state: LockState) => void;
    recordActivity: () => void;
    setLatestAudit: (result: AuditResult | null) => void;
    setAuditInProgress: (inProgress: boolean) => void;
    setNetworkStatus: (status: NetworkStatus | null) => void;
    setPanicMode: (active: boolean) => void;
    setDuressMode: (active: boolean) => void;
    setDefaultDisappearTime: (timeMs: number) => void;
    setDeadManDays: (days: number) => void;
    checkIn: () => void;
    recordScreenshotAttempt: () => void;
    resetSecurityState: () => void;
}

const DEFAULT_TOGGLES: SecurityToggles = {
    screenshotProtection: true,
    biometricUnlock: true,
    biometricPerMessage: false,
    zkAudit: true,
    disappearingMessages: true,
    antiSurveillance: true,
    dummyTraffic: false,
    deadManSwitch: false,
};

export const useSecurityStore = create<SecurityState>()(
    persist(
        (set) => ({
            // Initial state
            toggles: { ...DEFAULT_TOGGLES },
            lockState: 'unlocked',
            lastActivityTime: Date.now(),
            latestAudit: null,
            auditInProgress: false,
            networkStatus: null,
            panicMode: false,
            duressMode: false,
            defaultDisappearTime: 24 * 60 * 60 * 1000, // 24 hours
            deadManDays: 30,
            lastCheckIn: Date.now(),
            screenshotAttempts: 0,

            // Actions
            setToggle: (key, value) =>
                set((state) => ({
                    toggles: { ...state.toggles, [key]: value },
                })),

            setAllToggles: (toggles) =>
                set((state) => ({
                    toggles: { ...state.toggles, ...toggles },
                })),

            setLockState: (lockState) => set({ lockState }),

            recordActivity: () => set({ lastActivityTime: Date.now() }),

            setLatestAudit: (latestAudit) => set({ latestAudit }),

            setAuditInProgress: (auditInProgress) => set({ auditInProgress }),

            setNetworkStatus: (networkStatus) => set({ networkStatus }),

            setPanicMode: (panicMode) => set({ panicMode }),

            setDuressMode: (duressMode) => set({ duressMode }),

            setDefaultDisappearTime: (defaultDisappearTime) =>
                set({ defaultDisappearTime }),

            setDeadManDays: (deadManDays) => set({ deadManDays }),

            checkIn: () => set({ lastCheckIn: Date.now() }),

            recordScreenshotAttempt: () =>
                set((state) => ({
                    screenshotAttempts: state.screenshotAttempts + 1,
                })),

            resetSecurityState: () =>
                set({
                    toggles: { ...DEFAULT_TOGGLES },
                    lockState: 'unlocked',
                    latestAudit: null,
                    auditInProgress: false,
                    networkStatus: null,
                    panicMode: false,
                    duressMode: false,
                    screenshotAttempts: 0,
                }),
        }),
        {
            name: 'duograph-security',
            partialize: (state) => ({
                toggles: state.toggles,
                defaultDisappearTime: state.defaultDisappearTime,
                deadManDays: state.deadManDays,
                lastCheckIn: state.lastCheckIn,
            }),
        }
    )
);

// Selectors
export const selectIsLocked = (state: SecurityState) =>
    state.lockState === 'locked';

export const selectIsSecure = (state: SecurityState) =>
    state.toggles.screenshotProtection &&
    state.toggles.biometricUnlock &&
    state.toggles.zkAudit;

export const selectAuditStatus = (state: SecurityState) => {
    if (!state.latestAudit) return 'never_run';
    if (state.latestAudit.isValid) return 'valid';
    return 'mismatch';
};

export const selectDaysUntilDeadMan = (state: SecurityState) => {
    if (!state.toggles.deadManSwitch) return null;
    const triggerTime = state.lastCheckIn + state.deadManDays * 24 * 60 * 60 * 1000;
    const remaining = triggerTime - Date.now();
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
};
