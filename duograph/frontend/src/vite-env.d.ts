/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_BASE_SEPOLIA_RPC: string
    readonly VITE_BUNDLER_URL: string
    readonly VITE_IPFS_GATEWAY: string
    readonly VITE_IPFS_API: string
    readonly VITE_PINATA_JWT: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

// Buffer global declaration
declare global {
    interface Window {
        Buffer: typeof import('buffer').Buffer
    }
}
