'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { polygonAmoy, baseSepolia, Chain } from 'viem/chains';
import { createPublicClient } from 'viem';
import {
    type P256Credential,
    type SmartAccount,
    toWebAuthnAccount,
    createBundlerClient,
} from 'viem/account-abstraction';
import {
    WebAuthnMode,
    toCircleSmartAccount,
    toModularTransport,
    toPasskeyTransport,
    toWebAuthnCredential,
    encodeTransfer,
} from '@circle-fin/modular-wallets-core';

// Token addresses for USDC on each network
const USDC_ADDRESSES = {
    polygon: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582', // USDC on Polygon Amoy
    base: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
};

// USDC decimals - typically 6 for USDC
const USDC_DECIMALS = {
    polygon: 6,
    base: 6,
};

// Types
interface ChainConfig {
    chain: Chain;
    networkPath: string; // Path to add to client URL (e.g., '/polygonAmoy')
}

interface ChainAccounts {
    polygon: {
        smartAccount: SmartAccount | null;
        address: string | null;
        bundlerClient: any | null;
        publicClient: any | null;
    };
    base: {
        smartAccount: SmartAccount | null;
        address: string | null;
        bundlerClient: any | null;
        publicClient: any | null;
    };
}

interface TokenBalances {
    polygon: {
        usdc: string;
        native: string;
    };
    base: {
        usdc: string;
        native: string;
    };
}

interface Web3ContextType {
    accounts: ChainAccounts;
    activeChain: 'polygon' | 'base';
    setActiveChain: (chain: 'polygon' | 'base') => void;
    isConnected: boolean;
    isInitialized: boolean;
    error: string | null;
    registerPasskey: (username: string) => Promise<void>;
    loginWithPasskey: () => Promise<void>;
    sendTransaction: (to: string, value: string) => Promise<string | null>;
    sendUSDC: (to: string, amount: string) => Promise<string | null>;
    getUSDCBalance: () => Promise<string | null>;
    balances: TokenBalances;
    refreshBalances: () => Promise<void>;
    signMessage: (message: string) => Promise<string | null>;
    signTypedData: (data: any) => Promise<string | null>;
    getAddress: () => Promise<string | null>;
}

// Chain configurations
const chainConfigs = {
    polygon: {
        chain: polygonAmoy,
        networkPath: '/polygonAmoy',
    },
    base: {
        chain: baseSepolia,
        networkPath: '/baseSepolia',
    }
};

// Initial empty balances
const initialBalances: TokenBalances = {
    polygon: { usdc: '0', native: '0' },
    base: { usdc: '0', native: '0' }
};

// Create context
const Web3Context = createContext<Web3ContextType>({
    accounts: {
        polygon: { smartAccount: null, address: null, bundlerClient: null, publicClient: null },
        base: { smartAccount: null, address: null, bundlerClient: null, publicClient: null },
    },
    activeChain: 'polygon',
    setActiveChain: () => { },
    isConnected: false,
    isInitialized: false,
    error: null,
    registerPasskey: async () => { },
    loginWithPasskey: async () => { },
    sendTransaction: async () => null,
    sendUSDC: async () => null,
    getUSDCBalance: async () => null,
    balances: initialBalances,
    refreshBalances: async () => { },
    signMessage: async () => null,
    signTypedData: async () => null,
    getAddress: async () => null,
});

// Hook to use the Web3 context
export const useWeb3 = () => useContext(Web3Context);

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? process.env.NEXT_PUBLIC_VERCEL_URL
    : "http://localhost:3000";

// Provider component
export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<ChainAccounts>({
        polygon: { smartAccount: null, address: null, bundlerClient: null, publicClient: null },
        base: { smartAccount: null, address: null, bundlerClient: null, publicClient: null },
    });
    const [activeChain, setActiveChain] = useState<'polygon' | 'base'>('polygon');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [credential, setCredential] = useState<P256Credential | null>(null);
    const [balances, setBalances] = useState<TokenBalances>(initialBalances);

    // This effect runs only on the client side
    useEffect(() => {
        // Only run in browser environment
        if (typeof window === 'undefined') return;

        // Get env variables - safe to access on client side
        const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY as string;
        const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL as string;

        if (!clientKey || !clientUrl) {
            console.error('Missing Circle API configuration');
            setError('Missing Circle API configuration');
            setIsInitialized(true);
            return;
        }

        // Create Circle passkey transport
        const passkeyTransport = toPasskeyTransport(clientUrl, clientKey);

        // Function to load credential from database
        const loadCredential = async () => {
            try {
                // Fetch credential from the API
                const response = await fetch(`${baseUrl}/api/get-credential`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // Include credentials for auth cookies
                    credentials: 'include',
                });

                if (!response.ok) {
                    return null;
                }

                const data = await response.json();

                // If credential exists in the response
                if (data && data.credential) {
                    // Parse the credential string from the database
                    const parsedCredential = JSON.parse(data.credential[0].passkey_credential) as P256Credential;
                    setCredential(parsedCredential);
                    return parsedCredential;
                }
            } catch (e) {
                console.error('Error loading credential from database:', e);
            }
            return null;
        };

        // Initialize client for a specific chain - client side only
        const initializeChain = async (
            chainType: 'polygon' | 'base',
            credentialData: P256Credential
        ): Promise<{
            smartAccount: SmartAccount | null,
            address: string | null,
            bundlerClient: any | null,
            publicClient: any | null
        }> => {
            try {
                const config = chainConfigs[chainType];

                // Create modular transport for the chain
                const modularTransport = toModularTransport(
                    `${clientUrl}${config.networkPath}`,
                    clientKey
                );

                // Create public client
                const publicClient = createPublicClient({
                    chain: config.chain,
                    transport: modularTransport,
                });

                // Create WebAuthn account
                const webAuthnAccount = toWebAuthnAccount({
                    credential: credentialData
                });

                // Create Circle smart account
                const circleAccount = await toCircleSmartAccount({
                    client: publicClient,
                    owner: webAuthnAccount,
                });

                // Create bundler client
                const bundlerClient = createBundlerClient({
                    account: circleAccount,
                    chain: config.chain,
                    transport: modularTransport,
                });

                // Get address
                const address = circleAccount.address;
                return {
                    smartAccount: circleAccount,
                    address,
                    bundlerClient,
                    publicClient
                };
            } catch (error) {
                console.error(`Error initializing ${chainType}:`, error);
                return {
                    smartAccount: null,
                    address: null,
                    bundlerClient: null,
                    publicClient: null
                };
            }
        };

        const initializeWeb3ForAllChains = async (credentialData: P256Credential) => {
            try {
                setError(null);

                // Initialize the primary chain first (polygon)
                const polygonData = await initializeChain('polygon', credentialData);

                // Try to initialize Base, but don't block if it fails
                let baseData: {
                    smartAccount: SmartAccount | null;
                    address: string | null;
                    bundlerClient: any | null;
                    publicClient: any | null;
                } = {
                    smartAccount: null,
                    address: null,
                    bundlerClient: null,
                    publicClient: null
                };

                try {
                    baseData = await initializeChain('base', credentialData);
                } catch (error) {
                    console.error('Error initializing Base chain:', error);
                    // Continue with just Polygon
                }

                // First, update accounts state - important to do this before changing isConnected
                setAccounts({
                    polygon: polygonData,
                    base: baseData,
                });

                // Then set connected state to trigger UI updates
                const isAnyConnected = !!polygonData.address || !!baseData.address;
                setIsConnected(isAnyConnected);

                // Add a small delay before fetching balances to avoid race conditions
                if (isAnyConnected) {
                    setTimeout(async () => {
                        try {
                            await fetchAllBalances({
                                polygon: polygonData,
                                base: baseData
                            });
                        } catch (error) {
                            console.error('Error fetching initial balances:', error);
                            // Continue even if balance fetching fails
                        }
                    }, 500);
                }
            } catch (error) {
                console.error('Error initializing Web3:', error);
                setError(error instanceof Error ? error.message : 'Failed to initialize Web3');
            } finally {
                setIsInitialized(true);
            }
        };
        // Fetch balances using viem client
        const fetchAllBalances = async (chainAccounts: ChainAccounts) => {
            const newBalances = { ...initialBalances };

            // Fetch Polygon balances
            if (chainAccounts.polygon.address && chainAccounts.polygon.publicClient) {
                try {
                    // Native token balance
                    const nativeBalance = await chainAccounts.polygon.publicClient.getBalance({
                        address: chainAccounts.polygon.address
                    });

                    newBalances.polygon.native = (Number(nativeBalance) / 1e18).toString();

                    // USDC balance
                    const tokenAddress = USDC_ADDRESSES.polygon;
                    try {
                        const result = await chainAccounts.polygon.publicClient.readContract({
                            address: tokenAddress,
                            abi: [{
                                name: 'balanceOf',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [{ name: 'account', type: 'address' }],
                                outputs: [{ name: '', type: 'uint256' }],
                            }],
                            functionName: 'balanceOf',
                            args: [chainAccounts.polygon.address]
                        });

                        const divisor = 10 ** USDC_DECIMALS.polygon;
                        newBalances.polygon.usdc = (Number(result) / divisor).toString();
                    } catch (error) {
                        console.error('Error fetching Polygon USDC balance:', error);
                        newBalances.polygon.usdc = balances.polygon.usdc;
                    }
                } catch (error) {
                    console.error('Error fetching Polygon balances:', error);
                    newBalances.polygon = balances.polygon;
                }
            }

            // Fetch Base balances
            if (chainAccounts.base.address && chainAccounts.base.publicClient) {
                try {
                    // Native token balance
                    const nativeBalance = await chainAccounts.base.publicClient.getBalance({
                        address: chainAccounts.base.address
                    });

                    newBalances.base.native = (Number(nativeBalance) / 1e18).toString();

                    // USDC balance
                    const tokenAddress = USDC_ADDRESSES.base;
                    try {
                        const result = await chainAccounts.base.publicClient.readContract({
                            address: tokenAddress,
                            abi: [{
                                name: 'balanceOf',
                                type: 'function',
                                stateMutability: 'view',
                                inputs: [{ name: 'account', type: 'address' }],
                                outputs: [{ name: '', type: 'uint256' }],
                            }],
                            functionName: 'balanceOf',
                            args: [chainAccounts.base.address]
                        });

                        const divisor = 10 ** USDC_DECIMALS.base;
                        newBalances.base.usdc = (Number(result) / divisor).toString();
                    } catch (error) {
                        console.error('Error fetching Base USDC balance:', error);
                        newBalances.base.usdc = balances.base.usdc;
                    }
                } catch (error) {
                    console.error('Error fetching Base balances:', error);
                    newBalances.base = balances.base;
                }
            }

            // Update balances state
            setBalances(newBalances);
        };

        // Register a new passkey
        const registerPasskey = async (username: string) => {
            try {
                setError(null);

                const newCredential = await toWebAuthnCredential({
                    transport: passkeyTransport,
                    mode: WebAuthnMode.Register,
                    username,
                });

                // Set credential in state directly
                setCredential(newCredential);

                // Initialize with the new credential for all chains
                await initializeWeb3ForAllChains(newCredential);

                // Save the credential to the database via API
                // We don't need to send the email/username as the API will get the user from the session
                const response = await fetch(`${baseUrl}/api/update-passkey`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        credential: JSON.stringify(newCredential)
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Failed to save credential to database: ${errorData.error || response.status}`);
                }

                return newCredential;
            } catch (error) {
                console.error('Error registering passkey:', error);
                setError(error instanceof Error ? error.message : 'Failed to register passkey');
                throw error;
            }
        };

        // Login with existing passkey
        const loginWithPasskey = async () => {
            try {
                setError(null);

                const newCredential = await toWebAuthnCredential({
                    transport: passkeyTransport,
                    mode: WebAuthnMode.Login,
                });

                // Set the credential in state directly
                setCredential(newCredential);

                // Initialize with the retrieved credential for all chains
                await initializeWeb3ForAllChains(newCredential);

                // Save or update the credential in the database
                try {
                    const response = await fetch(`${baseUrl}/api/update-login-credential`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            credential: JSON.stringify(newCredential)
                        })
                    });

                    if (!response.ok) {
                        console.warn('Failed to update credential in database on login');
                        // Continue even if this fails - not critical for login flow
                    }
                } catch (error) {
                    console.warn('Error updating credential in database on login:', error);
                    // Continue even if this fails - not critical for login flow
                }

                return newCredential;
            } catch (error) {
                console.error('Error logging in with passkey:', error);
                setError(error instanceof Error ? error.message : 'Failed to login with passkey');
                throw error;
            }
        };

        // Refresh all balances
        const refreshBalances = async () => {
            await fetchAllBalances(accounts);
        };

        // Set context methods
        setContextMethods({
            registerPasskey,
            loginWithPasskey,
            refreshBalances
        });

        // Async initialization function
        const initializeFromDatabase = async () => {
            try {
                // Load credential from database via API
                const credentialData = await loadCredential();

                if (credentialData) {
                    await initializeWeb3ForAllChains(credentialData);
                } else {
                    setIsInitialized(true);
                }
            } catch (error) {
                console.error('Error during initialization:', error);
                setError(error instanceof Error ? error.message : 'Failed to initialize');
                setIsInitialized(true);
            }
        };

        // Start the initialization process
        initializeFromDatabase();
    }, []);

    // State to hold methods created in the useEffect
    const [contextMethods, setContextMethods] = useState<{
        registerPasskey: (username: string) => Promise<any>;
        loginWithPasskey: () => Promise<any>;
        refreshBalances: () => Promise<void>;
    }>({
        registerPasskey: async () => {
            throw new Error('Not initialized yet');
        },
        loginWithPasskey: async () => {
            throw new Error('Not initialized yet');
        },
        refreshBalances: async () => {
            throw new Error('Not initialized yet');
        }
    });

    // Get active chain address
    const getAddress = async (): Promise<string | null> => {
        const activeAccount = accounts[activeChain];
        if (!activeAccount.address) {
            setError(`Account not initialized for ${activeChain} chain`);
            return null;
        }

        return activeAccount.address;
    };

    // Send native token transaction
    const sendTransaction = async (to: string, value: string): Promise<string | null> => {
        const activeAccount = accounts[activeChain];
        if (!activeAccount.bundlerClient || !activeAccount.smartAccount) {
            setError(`Account not initialized for ${activeChain} chain`);
            return null;
        }

        try {
            // Convert value from ETH to wei
            const valueInWei = BigInt(Math.floor(parseFloat(value) * 1e18));

            // Send the transaction using userOp
            const userOpHash = await activeAccount.bundlerClient.sendUserOperation({
                calls: [{
                    to: to as `0x${string}`,
                    value: valueInWei,
                    data: '0x' as `0x${string}`
                }],
                paymaster: true, // Use paymaster for gasless transactions
            });

            // Wait for the transaction receipt
            const { receipt } = await activeAccount.bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
            });

            // Refresh balances after successful transaction
            contextMethods.refreshBalances().catch(err => {
                console.error('Failed to refresh balances after transaction:', err);
            });

            return receipt.transactionHash;
        } catch (error) {
            console.error(`Error sending transaction on ${activeChain}:`, error);
            setError(error instanceof Error ? error.message : 'Failed to send transaction');
            return null;
        }
    };

    // Send USDC tokens
    const sendUSDC = async (to: string, amount: string): Promise<string | null> => {
        const activeAccount = accounts[activeChain];
        if (!activeAccount.bundlerClient || !activeAccount.smartAccount) {
            setError(`Account not initialized for ${activeChain} chain`);
            return null;
        }

        try {
            // Get the USDC contract address for the active chain
            const tokenAddress = USDC_ADDRESSES[activeChain];
            const decimals = USDC_DECIMALS[activeChain];

            // Convert amount to token units
            const tokenAmount = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));

            // Send the token transfer using userOp with encodeTransfer
            const userOpHash = await activeAccount.bundlerClient.sendUserOperation({
                calls: [
                    encodeTransfer(
                        to as `0x${string}`,
                        tokenAddress as `0x${string}`,
                        tokenAmount
                    )
                ],
                paymaster: true, // Use paymaster for gasless transactions
            });

            // Wait for the transaction receipt
            const { receipt } = await activeAccount.bundlerClient.waitForUserOperationReceipt({
                hash: userOpHash,
            });

            // Refresh balances after successful transaction
            contextMethods.refreshBalances().catch(err => {
                console.error('Failed to refresh balances after USDC transfer:', err);
            });

            return receipt.transactionHash;
        } catch (error) {
            console.error(`Error sending USDC on ${activeChain}:`, error);
            setError(error instanceof Error ? error.message : 'Failed to send USDC');
            return null;
        }
    };

    // Get USDC balance for active chain
    const getUSDCBalance = async (): Promise<string | null> => {
        return balances[activeChain].usdc;
    };

    // Sign a message
    const signMessage = async (message: string): Promise<string | null> => {
        const activeAccount = accounts[activeChain];
        if (!activeAccount.smartAccount) {
            setError(`Account not initialized for ${activeChain} chain`);
            return null;
        }

        try {
            // Smart accounts use signMessage method
            const signature = await activeAccount.smartAccount.signMessage({
                message
            });

            return signature;
        } catch (error) {
            console.error(`Error signing message on ${activeChain}:`, error);
            setError(error instanceof Error ? error.message : 'Failed to sign message');
            return null;
        }
    };

    // Sign typed data according to EIP-712
    const signTypedData = async (data: any): Promise<string | null> => {
        const activeAccount = accounts[activeChain];
        if (!activeAccount.smartAccount) {
            setError(`Account not initialized for ${activeChain} chain`);
            return null;
        }

        try {
            // Smart accounts use signTypedData method
            const signature = await activeAccount.smartAccount.signTypedData(data);
            return signature;
        } catch (error) {
            console.error(`Error signing typed data on ${activeChain}:`, error);
            setError(error instanceof Error ? error.message : 'Failed to sign typed data');
            return null;
        }
    };

    const contextValue: Web3ContextType = {
        accounts,
        activeChain,
        setActiveChain,
        isConnected,
        isInitialized,
        error,
        registerPasskey: contextMethods.registerPasskey,
        loginWithPasskey: contextMethods.loginWithPasskey,
        sendTransaction,
        sendUSDC,
        getUSDCBalance,
        balances,
        refreshBalances: contextMethods.refreshBalances,
        signMessage,
        signTypedData,
        getAddress,
    };

    return (
        <Web3Context.Provider value={contextValue}>
            {children}
        </Web3Context.Provider>
    );
};