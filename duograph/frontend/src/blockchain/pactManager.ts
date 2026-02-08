import { Contract, JsonRpcSigner } from 'ethers';
import {
    CONTRACT_ADDRESSES,
    getPactFactoryInterface,
    getBinaryPactInterface
} from './contracts';
import { getProvider } from './wallet';

export interface PactInfo {
    pactId: string;
    pactAddress: string;
    user1: string;
    user2: string;
    createdAt: number;
    isActive: boolean;
}

export const createPact = async (signer: JsonRpcSigner, partnerAddress: string): Promise<string> => {
    const factory = new Contract(
        CONTRACT_ADDRESSES.PactFactory,
        getPactFactoryInterface(),
        signer
    );

    const user1 = await signer.getAddress();
    const user2 = partnerAddress;

    try {
        // Check if pact already exists
        const [exists, existingPactId] = await factory.checkPactExists(user1, user2);
        if (exists) {
            console.log("Pact already exists with ID:", existingPactId);
            // We might want to return the address or throw
            // For now, let's try to get the address from the ID
            const pactDetails = await factory.getPact(existingPactId);
            return pactDetails.pactAddress;
        }

        const tx = await factory.createPact(user1, user2);
        await tx.wait();

        // Parse event to get pact address
        // Event: PactCreated(uint256,address,address,address,uint256)
        // We can allow the UI to refetch or return the likely address if simpler

        // For now, let's fetch the pact again using checkPactExists which is robust
        const [, newPactId] = await factory.checkPactExists(user1, user2);
        const pactDetails = await factory.getPact(newPactId);

        return pactDetails.pactAddress;
    } catch (error) {
        console.error("Failed to create pact:", error);
        throw error;
    }
};

export const getUserPacts = async (userAddress: string): Promise<PactInfo[]> => {
    const provider = getProvider();
    if (!provider) throw new Error("Provider not connected");

    const factory = new Contract(
        CONTRACT_ADDRESSES.PactFactory,
        getPactFactoryInterface(),
        provider
    );

    try {
        const pactIds = await factory.getUserPacts(userAddress);

        const pacts = await Promise.all(pactIds.map(async (id: bigint) => {
            const details = await factory.getPact(id);
            return {
                pactId: details.pactId.toString(),
                pactAddress: details.pactAddress,
                user1: details.user1,
                user2: details.user2,
                createdAt: Number(details.createdAt),
                isActive: details.isActive
            };
        }));

        return pacts;
    } catch (error) {
        console.error("Failed to fetch user pacts:", error);
        return [];
    }
};

export const getPactStatus = async (pactAddress: string): Promise<{ isActive: boolean; created: bigint; dissolved: bigint }> => {
    const provider = getProvider();
    if (!provider) throw new Error("Provider not connected");

    const pactContract = new Contract(
        pactAddress,
        getBinaryPactInterface(),
        provider
    );

    try {
        return await pactContract.getStatus();
    } catch (error) {
        console.error("Failed to get pact status:", error);
        throw error;
    }
};
