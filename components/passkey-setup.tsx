'use client';

import { useState } from 'react';
import {
    WebAuthnMode,
    toPasskeyTransport,
    toWebAuthnCredential,
} from '@circle-fin/modular-wallets-core';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { polygonAmoy } from 'viem/chains';
import { createPublicClient } from 'viem';
import {
    toWebAuthnAccount,
} from 'viem/account-abstraction';
import {
    toCircleSmartAccount,
    toModularTransport,
} from '@circle-fin/modular-wallets-core';

interface PasskeySetupProps {
    username: string;
}

// This component handles the wallet setup after user registration
export function PasskeySetup({ username }: PasskeySetupProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY;
    const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL;

    // Create Circle transports - only in browser
    const passkeyTransport = typeof window !== 'undefined'
        ? toPasskeyTransport(clientUrl, clientKey)
        : null;

    const setupPasskey = async () => {
        if (!passkeyTransport) {
            setError("Browser environment not available");
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            // Create passkey credential
            const credential = await toWebAuthnCredential({
                transport: passkeyTransport,
                mode: WebAuthnMode.Register,
                username,
            });

            // Get the real Circle address
            let circleAddress;
            try {
                // Create WebAuthn account
                const webAuthnAccount = toWebAuthnAccount({
                    credential
                });

                // Create modular transport for Polygon
                const modularTransport = toModularTransport(
                    `${clientUrl}/polygonAmoy`,
                    clientKey
                );

                // Create public client
                const publicClient = createPublicClient({
                    chain: polygonAmoy,
                    transport: modularTransport,
                });

                // Create Circle smart account to get the actual address
                const circleAccount = await toCircleSmartAccount({
                    client: publicClient,
                    owner: webAuthnAccount,
                });

                // Get the real address
                circleAddress = circleAccount.address.toLowerCase();
            } catch (e) {
                console.warn("Could not get Circle address:", e);
                // Continue without the address if there's an error
            }

            // Call API to set up wallets with the passkey - now storing in database
            const response = await fetch('/api/setup-wallets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credential: JSON.stringify(credential),
                    circleAddress // Pass this to the API
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to set up wallets');
            }

            // Force a small delay to ensure all database writes complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Parse the response data
            try {
                const responseData = await response.json();
            } catch (e) {
                console.warn("Could not parse response JSON", e);
            }

            // Force redirect to dashboard
            window.location.href = '/dashboard';
        } catch (err) {
            console.error("Passkey creation failed:", err);
            setError(err instanceof Error ? err.message : 'Failed to create passkey');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4 p-6">
            <h2 className="text-xl font-semibold">Set Up Your Wallet with Passkey</h2>
            <p className="text-muted-foreground text-center max-w-md">
                Set up your wallet using a passkey for enhanced security.
                This allows you to sign transactions with biometric authentication.
            </p>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            <Button
                onClick={setupPasskey}
                disabled={isCreating}
                className="w-full max-w-xs"
            >
                {isCreating ? 'Setting up passkey...' : 'Set up with passkey'}
            </Button>

            <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="w-full max-w-xs"
            >
                Skip for now
            </Button>
        </div>
    );
}