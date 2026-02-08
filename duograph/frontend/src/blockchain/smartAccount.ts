import { Contract, JsonRpcSigner, concat, type Provider, type Signer } from 'ethers';
import {
    CONTRACT_ADDRESSES,
    getAccountFactoryInterface,
    getAccountInterface
} from './contracts';
import { getProvider, getSigner } from './wallet';

// Determine the salt for deterministic deployment
// For simplicity, we can use a hash of the user's EOA address or a fixed value for the first account
export const DEFAULT_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const getSmartAccountAddress = async (ownerAddress: string, salt: string = DEFAULT_SALT): Promise<string> => {
    const provider = getProvider();
    if (!provider) throw new Error("Provider not connected");

    const factory = new Contract(
        CONTRACT_ADDRESSES.DuoGraphAccountFactory,
        getAccountFactoryInterface(),
        provider
    );

    try {
        return await factory.getAddress(ownerAddress, salt);
    } catch (error) {
        console.error("Failed to get smart account address:", error);
        throw error;
    }
};

export const deploySmartAccount = async (signer: JsonRpcSigner, salt: string = DEFAULT_SALT): Promise<string> => {
    const factory = new Contract(
        CONTRACT_ADDRESSES.DuoGraphAccountFactory,
        getAccountFactoryInterface(),
        signer
    );

    const ownerAddress = await signer.getAddress();

    // Check if already deployed
    const accountAddress = await getSmartAccountAddress(ownerAddress, salt);
    const code = await signer.provider.getCode(accountAddress);

    if (code !== '0x') {
        return accountAddress; // Already deployed
    }

    try {
        // For now, we are not passing a public key for a secondary key, just using EOA as owner.
        // The factory expects (owner, publicKey, salt).
        // We can pass empty bytes for publicKey if the contract handles it (it usually initializes a P256 key or similar).
        // Based on ABI: createAccount(address owner, bytes calldata publicKey, bytes32 salt)
        const publicKey = '0x';

        const tx = await factory.createAccount(ownerAddress, publicKey, salt);
        await tx.wait();
        return accountAddress;
    } catch (error) {
        console.error("Failed to deploy smart account:", error);
        throw error;
    }
};

export const getSmartAccountContract = (accountAddress: string, signerOrProvider?: Signer | Provider) => {
    const signer = getSigner();
    const provider = getProvider();
    const runner = signerOrProvider || signer || provider;

    if (!runner) throw new Error("No signer or provider available");

    return new Contract(
        accountAddress,
        getAccountInterface(),
        runner
    );
};

// Helper to check if a specific address is a smart account deployed by our factory
export const isSmartAccountDeployed = async (accountAddress: string): Promise<boolean> => {
    try {
        const provider = getProvider();
        if (!provider) return false;
        const code = await provider.getCode(accountAddress);
        return code !== '0x';
    } catch {
        return false;
    }
};

export const getSmartAccountNonce = async (accountAddress: string): Promise<bigint> => {
    const provider = getProvider();
    if (!provider) throw new Error("Provider not connected");
    const account = new Contract(
        accountAddress,
        getAccountInterface(),
        provider
    );
    try {
        return await account.nonce();
    } catch {
        return 0n; // Fallback or if not deployed? If not deployed, nonce should be 0.
    }
};

export const getAccountInitCode = (ownerAddress: string, salt: string = DEFAULT_SALT): string => {
    const factoryInterface = getAccountFactoryInterface();
    const publicKey = '0x';
    const data = factoryInterface.encodeFunctionData('createAccount', [ownerAddress, publicKey, salt]);
    return concat([CONTRACT_ADDRESSES.DuoGraphAccountFactory, data]);
};

export const encodeExecuteCalldata = (target: string, value: bigint, data: string): string => {
    const accountInterface = getAccountInterface();
    return accountInterface.encodeFunctionData('execute', [target, value, data]);
};
