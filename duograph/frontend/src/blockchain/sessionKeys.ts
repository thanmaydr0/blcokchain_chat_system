import { Wallet, keccak256, solidityPacked } from 'ethers';
import { getProvider, getSigner } from './wallet';
import { Contract } from 'ethers';
import { getBinaryPactInterface } from './contracts';

const SESSION_KEY_STORAGE_PREFIX = 'duograph_session_key_';

export interface SessionKeyInfo {
    address: string;
    privateKey: string;
    expiresAt?: number;
}

export const generateSessionKey = (pactAddress: string): SessionKeyInfo => {
    const wallet = Wallet.createRandom();
    const info: SessionKeyInfo = {
        address: wallet.address,
        privateKey: wallet.privateKey,
    };

    localStorage.setItem(SESSION_KEY_STORAGE_PREFIX + pactAddress, JSON.stringify(info));
    return info;
};

export const getStoredSessionKey = (pactAddress: string): SessionKeyInfo | null => {
    const data = localStorage.getItem(SESSION_KEY_STORAGE_PREFIX + pactAddress);
    if (!data) return null;
    try {
        return JSON.parse(data) as SessionKeyInfo;
    } catch {
        return null;
    }
};

export const clearSessionKey = (pactAddress: string) => {
    localStorage.removeItem(SESSION_KEY_STORAGE_PREFIX + pactAddress);
};

export const registerSessionKeyOnChain = async (
    pactAddress: string,
    sessionKeyAddress: string,
    validitySeconds: number = 86400 * 7 // 7 days default
) => {
    const signer = getSigner();
    if (!signer) throw new Error("Wallet not connected");

    const pact = new Contract(pactAddress, getBinaryPactInterface(), signer);

    // Assuming the contract validates keccak256(abi.encodePacked(address)) or similar
    // Based on common patterns: bytes32 keyHash = keccak256(abi.encodePacked(sessionKeyAddress));
    const keyHash = keccak256(solidityPacked(['address'], [sessionKeyAddress]));

    try {
        const tx = await pact.registerSessionKey(keyHash, validitySeconds);
        await tx.wait();
        console.log(`Session key ${sessionKeyAddress} registered for pact ${pactAddress}`);
    } catch (error) {
        console.error("Failed to register session key:", error);
        throw error;
    }
};

export const signWithSessionKey = async (pactAddress: string, messageHash: string) => {
    const sessionKeyInfo = getStoredSessionKey(pactAddress);
    if (!sessionKeyInfo) throw new Error("No session key found for this pact");

    const provider = getProvider(); // Session keys might not need a provider if just signing
    const wallet = new Wallet(sessionKeyInfo.privateKey, provider || undefined);

    // Signing the binary message hash
    return await wallet.signMessage(messageHash);
};
