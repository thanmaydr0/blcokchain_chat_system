import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Pact, Message, Settings, Notification, Call } from '../types';

// Auth store
interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    walletAddress: string | null;
    setUser: (user: User | null) => void;
    setWalletAddress: (address: string | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            walletAddress: null,
            setUser: (user) =>
                set({ user, isAuthenticated: !!user, isLoading: false }),
            setWalletAddress: (walletAddress) => set({ walletAddress }),
            setLoading: (isLoading) => set({ isLoading }),
            logout: () =>
                set({ user: null, isAuthenticated: false, walletAddress: null }),
        }),
        {
            name: 'duograph-auth',
            partialize: (state) => ({ walletAddress: state.walletAddress }),
        }
    )
);

// Pact store
interface PactState {
    pacts: Pact[];
    activePact: Pact | null;
    isLoading: boolean;
    setPacts: (pacts: Pact[]) => void;
    addPact: (pact: Pact) => void;
    updatePact: (pactId: string, updates: Partial<Pact>) => void;
    setActivePact: (pact: Pact | null) => void;
    removePact: (pactId: string) => void;
}

export const usePactStore = create<PactState>()((set) => ({
    pacts: [],
    activePact: null,
    isLoading: false,
    setPacts: (pacts) => set({ pacts }),
    addPact: (pact) => set((state) => ({ pacts: [...state.pacts, pact] })),
    updatePact: (pactId, updates) =>
        set((state) => ({
            pacts: state.pacts.map((p) =>
                p.id === pactId ? { ...p, ...updates } : p
            ),
            activePact:
                state.activePact?.id === pactId
                    ? { ...state.activePact, ...updates }
                    : state.activePact,
        })),
    setActivePact: (activePact) => set({ activePact }),
    removePact: (pactId) =>
        set((state) => ({
            pacts: state.pacts.filter((p) => p.id !== pactId),
            activePact: state.activePact?.id === pactId ? null : state.activePact,
        })),
}));

// Messages store
interface MessageState {
    messages: Record<string, Message[]>; // Keyed by pactId
    isLoading: boolean;
    setMessages: (pactId: string, messages: Message[]) => void;
    addMessage: (pactId: string, message: Message) => void;
    updateMessage: (pactId: string, messageId: string, updates: Partial<Message>) => void;
    clearMessages: (pactId: string) => void;
}

export const useMessageStore = create<MessageState>()((set) => ({
    messages: {},
    isLoading: false,
    setMessages: (pactId, messages) =>
        set((state) => ({
            messages: { ...state.messages, [pactId]: messages },
        })),
    addMessage: (pactId, message) =>
        set((state) => ({
            messages: {
                ...state.messages,
                [pactId]: [...(state.messages[pactId] || []), message],
            },
        })),
    updateMessage: (pactId, messageId, updates) =>
        set((state) => ({
            messages: {
                ...state.messages,
                [pactId]: (state.messages[pactId] || []).map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                ),
            },
        })),
    clearMessages: (pactId) =>
        set((state) => {
            const newMessages = { ...state.messages };
            delete newMessages[pactId];
            return { messages: newMessages };
        }),
}));

// Call store
interface CallState {
    activeCall: Call | null;
    incomingCall: Call | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMuted: boolean;
    isVideoEnabled: boolean;
    setActiveCall: (call: Call | null) => void;
    setIncomingCall: (call: Call | null) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setRemoteStream: (stream: MediaStream | null) => void;
    toggleMute: () => void;
    toggleVideo: () => void;
    endCall: () => void;
}

export const useCallStore = create<CallState>()((set) => ({
    activeCall: null,
    incomingCall: null,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoEnabled: true,
    setActiveCall: (activeCall) => set({ activeCall }),
    setIncomingCall: (incomingCall) => set({ incomingCall }),
    setLocalStream: (localStream) => set({ localStream }),
    setRemoteStream: (remoteStream) => set({ remoteStream }),
    toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
    endCall: () =>
        set({
            activeCall: null,
            incomingCall: null,
            localStream: null,
            remoteStream: null,
            isMuted: false,
            isVideoEnabled: true,
        }),
}));

// Notifications store
interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Notification) => void;
    markAsRead: (notificationId: string) => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
    notifications: [],
    unreadCount: 0,
    addNotification: (notification) =>
        set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
        })),
    markAsRead: (notificationId) =>
        set((state) => ({
            notifications: state.notifications.map((n) =>
                n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
        })),
    markAllAsRead: () =>
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
        })),
    clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));

// Settings store
interface SettingsState {
    settings: Settings;
    updateSettings: (updates: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            settings: {
                theme: 'dark',
                notifications: true,
                soundEnabled: true,
                autoAcceptCalls: false,
                showReadReceipts: true,
            },
            updateSettings: (updates) =>
                set((state) => ({
                    settings: { ...state.settings, ...updates },
                })),
        }),
        {
            name: 'duograph-settings',
        }
    )
);

// UI store
interface UIState {
    sidebarOpen: boolean;
    modalOpen: string | null; // Modal identifier
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    openModal: (modalId: string) => void;
    closeModal: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
    sidebarOpen: true,
    modalOpen: null,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    openModal: (modalOpen) => set({ modalOpen }),
    closeModal: () => set({ modalOpen: null }),
}));
