import { useState, useEffect } from 'react';
import { OnboardingFlow } from './OnboardingFlow';
import { useWalletStore, connectWallet, deploySmartAccount, getSigner } from '../../blockchain';
import { useAuthStore } from '../../store';

interface OnboardingContainerProps {
    onComplete: () => void;
}

export const OnboardingContainer = ({ onComplete }: OnboardingContainerProps) => {
    const [currentStep, setCurrentStep] = useState(0);
    const { address, isConnecting } = useWalletStore();
    const { setWalletAddress } = useAuthStore();

    // Key Generation State
    const [keysGenerated, setKeysGenerated] = useState(false);
    const [keyProgress, setKeyProgress] = useState(0);

    // Invite State
    const [inviteCode, setInviteCode] = useState<string>();
    const [pendingInvite, setPendingInvite] = useState<{ code: string; fromAddress: string }>();

    // Use Effect to sync wallet address to auth store
    useEffect(() => {
        if (address) {
            setWalletAddress(address);
        }
    }, [address, setWalletAddress]);

    const handleNextStep = () => {
        setCurrentStep((prev) => Math.min(prev + 1, 3));
    };

    const handlePrevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const handleConnectWallet = async () => {
        try {
            await connectWallet();
            // If successful, effect will update auth store
            // We can also deploy account here if we want to ensure it exists
            // But maybe delay that to key generation or invite step to save time/gas?
            // Actually, standard is to just connect first.
        } catch (error) {
            console.error("Connection failed", error);
        }
    };

    const handleGenerateKeys = async () => {
        // Simulate complex key generation progress
        for (let i = 0; i <= 100; i += 10) {
            setKeyProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
        }

        // Here we would actually generate the Double Ratchet keys and store them locally
        // For now we just set the flag
        // TODO: Implement actual key generation via crypto module

        // Also, we might want to deploy the smart account now if not already?
        const signer = getSigner();
        if (signer) {
            try {
                await deploySmartAccount(signer);
            } catch (e) {
                console.error("Smart Account deployment check failed", e);
                // Non-blocking if it fails (maybe already deployed or network issue)
            }
        }

        setKeysGenerated(true);
    };

    const handleGenerateInvite = async () => {
        // Logic to generate an invite code
        // This could be a random string or a signed improved invite
        const code = "INV-" + crypto.randomUUID().slice(0, 8).toUpperCase();
        setInviteCode(code);

        // In a real app, we would store this invite hash on-chain or in Supabase
    };

    const handleScanInvite = () => {
        // Open camera or prompt
        const code = prompt("Enter invite code for now:");
        if (code) {
            setPendingInvite({ code, fromAddress: "0x..." });
            // Move to next step or complete logic
        }
    };

    const handleAcceptInvite = async (code: string) => {
        console.log("Accepting invite", code);
        // Blockchain transaction to accept pact
        onComplete();
    };

    return (
        <OnboardingFlow
            currentStep={currentStep}
            onNextStep={handleNextStep}
            onPrevStep={handlePrevStep}
            onComplete={onComplete}

            // Wallet
            onConnectWallet={handleConnectWallet}
            walletAddress={address || undefined}
            isConnecting={isConnecting}

            // Keys
            onGenerateKeys={handleGenerateKeys}
            keysGenerated={keysGenerated}
            keyGenerationProgress={keyProgress}

            // Invite
            inviteCode={inviteCode}
            onGenerateInvite={handleGenerateInvite}
            onScanInvite={handleScanInvite}

            // Accept
            onAcceptInvite={handleAcceptInvite}
            pendingInvite={pendingInvite}
        />
    );
};
