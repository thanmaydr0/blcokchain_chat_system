/**
 * Blockchain Module Exports
 * 
 * Central export point for all blockchain integration functionality.
 */

// Contract ABIs and addresses
export {
    CONTRACT_ADDRESSES,
    PACT_FACTORY_ABI,
    BINARY_PACT_ABI,
    ACCOUNT_FACTORY_ABI,
    SMART_ACCOUNT_ABI,
    ENTRYPOINT_ABI,
    PAYMASTER_ABI,
    getPactFactory,
    getBinaryPact,
    getAccountFactory,
    getEntryPoint,
    signPactCreation,
    PACT_FACTORY_DOMAIN,
    PACT_CREATION_TYPES,
} from './contracts';

export type { PactMetadata, SessionKey } from './contracts';

// Wallet connection
export {
    connectWallet,
    disconnectWallet,
    getWalletState,
    onWalletChange,
    ensureSepoliaNetwork,
    signMessage,
    getBalance,
} from './wallet';

export type { WalletState } from './wallet';

// Smart Account (ERC-4337)
export {
    getSmartAccountAddress,
    createSmartAccount,
    isSmartAccountDeployed,
    getSmartAccountNonce,
} from './smartAccount';

// Gasless transactions
export {
    buildUserOperation,
    submitUserOperation,
    executeGasless,
} from './gasless';

export type { GaslessResult } from './gasless';

// Pact management
export {
    generateInvite,
    parseInvite,
    createPact,
    createPactGasless,
    getPactDetails,
    getUserPacts,
    checkPactExists,
    registerPublicKey,
    type InviteData,
} from './pactManager';

// Session keys
export {
    registerSessionKey,
    rotateSessionKey,
    revokeSessionKey,
    getActiveSessionKeys,
    hasActiveSessionKey,
} from './sessionKeys';
