"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWeb3 } from "@/components/web3-provider";
import { toast } from "sonner";
import axios from "axios";
import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export function useWalletBalances() {
  const { accounts, activeChain, isConnected, isInitialized } = useWeb3();
  // Create Supabase client once per hook instance
  const supabaseRef = useRef(createSupabaseBrowserClient());

  const [balances, setBalances] = useState({
    polygon: {
      native: 0,
      token: 0,
      loading: true,
    },
    base: {
      native: 0,
      token: 0,
      loading: true,
    },
  });

  // Use refs to track if balances have been loaded and prevent infinite loops
  const balancesLoadedRef = useRef(false);
  const prevAccountsRef = useRef({
    polygon: null as string | null,
    base: null as string | null,
  });
  const isRefreshingRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);

  interface BalanceResponse {
    balance: string;
  }

  type ChainType = "polygon" | "base";

  // Fetch balance directly from Supabase
  const fetchBalanceFromDB = useCallback(
    async (address: string, chainType: ChainType): Promise<string> => {
      if (!address) return "0";

      try {
        // Query the database directly
        const { data, error } = await supabaseRef.current
          .from("wallets")
          .select("balance")
          .eq("wallet_address", address.toLowerCase())
          .eq("blockchain", chainType.toUpperCase())
          .single();

        if (error) {
          console.error(`Error fetching ${chainType} balance from DB:`, error);
          return "0";
        }

        return data?.balance || "0";
      } catch (error) {
        console.error(`Error fetching ${chainType} balance from DB:`, error);
        return "0";
      }
    },
    [],
  );

  // Fetch balance from API (keeps your existing implementation)
  const fetchBalanceFromAPI = useCallback(
    async (address: string, chainType: ChainType): Promise<string> => {
      if (!address) return "0";

      try {
        const response = await axios.post<BalanceResponse>(
          "/api/wallet/balance",
          {
            walletId: address,
            blockchain: chainType,
          },
        );

        return response.data.balance || "0";
      } catch (error) {
        console.error(`Error fetching ${chainType} balance from API:`, error);
        return "0";
      }
    },
    [],
  );

  // Load initial balances from DB, then refresh from API
  const loadBalances = useCallback(async () => {
    if (!isConnected || isRefreshingRef.current) return;

    if (!accounts.polygon.address && !accounts.base.address) {
      setBalances((prev) => ({
        polygon: { ...prev.polygon, loading: false },
        base: { ...prev.base, loading: false },
      }));
      return;
    }

    isRefreshingRef.current = true;

    // First set loading state
    setBalances((prev) => ({
      polygon: {
        ...prev.polygon,
        loading: Boolean(accounts.polygon.address),
      },
      base: {
        ...prev.base,
        loading: Boolean(accounts.base.address),
      },
    }));

    try {
      // STEP 1: Try to get balances from DB first (fast)
      const dbResults = await Promise.allSettled([
        accounts.polygon.address
          ? fetchBalanceFromDB(accounts.polygon.address, "polygon")
          : Promise.resolve("0"),
        accounts.base.address
          ? fetchBalanceFromDB(accounts.base.address, "base")
          : Promise.resolve("0"),
      ]);

      const polygonDBBalance =
        dbResults[0].status === "fulfilled" ? dbResults[0].value : "0";
      const baseDBBalance =
        dbResults[1].status === "fulfilled" ? dbResults[1].value : "0";

      // Update state with DB values immediately (faster UX)
      setBalances((prev) => ({
        polygon: {
          native: prev.polygon.native,
          token: parseFloat(polygonDBBalance) || 0,
          // Keep loading true while we fetch from API
          loading: Boolean(accounts.polygon.address),
        },
        base: {
          native: prev.base.native,
          token: parseFloat(baseDBBalance) || 0,
          loading: Boolean(accounts.base.address),
        },
      }));

      // STEP 2: Then fetch from API to ensure latest values (slower but accurate)
      const apiResults = await Promise.allSettled([
        accounts.polygon.address
          ? fetchBalanceFromAPI(accounts.polygon.address, "polygon")
          : Promise.resolve("0"),
        accounts.base.address
          ? fetchBalanceFromAPI(accounts.base.address, "base")
          : Promise.resolve("0"),
      ]);

      const polygonAPIBalance =
        apiResults[0].status === "fulfilled"
          ? apiResults[0].value
          : polygonDBBalance;
      const baseAPIBalance =
        apiResults[1].status === "fulfilled"
          ? apiResults[1].value
          : baseDBBalance;

      // Update state with API values and finish loading
      setBalances((prev) => ({
        polygon: {
          native: prev.polygon.native,
          token: parseFloat(polygonAPIBalance) || prev.polygon.token,
          loading: false,
        },
        base: {
          native: prev.base.native,
          token: parseFloat(baseAPIBalance) || prev.base.token,
          loading: false,
        },
      }));

      balancesLoadedRef.current = true;
    } catch (error) {
      console.error("Error refreshing balances:", error);
      toast.error("Failed to refresh balances");

      setBalances((prev) => ({
        polygon: { ...prev.polygon, loading: false },
        base: { ...prev.base, loading: false },
      }));
    } finally {
      isRefreshingRef.current = false;
    }
  }, [accounts, fetchBalanceFromDB, fetchBalanceFromAPI, isConnected]);

  // Helper to check if accounts have changed
  const haveAccountsChanged = useCallback(() => {
    const prev = prevAccountsRef.current;
    const current = accounts;

    const polygonChanged = prev.polygon !== current.polygon.address;
    const baseChanged = prev.base !== current.base.address;

    // Update the refs
    prevAccountsRef.current = {
      polygon: current.polygon.address,
      base: current.base.address,
    };

    return polygonChanged || baseChanged;
  }, [accounts]);

  // Handle realtime balance updates
  const updateWalletBalance = useCallback(
    (payload: any, chainType: ChainType) => {
      // Use the functional form of setState to access most recent state
      setBalances((prev) => {
        const currentBalance = prev[chainType].token;
        const newBalance = Number(payload.new.balance);

        if (isNaN(newBalance)) {
          console.error(
            "Invalid balance update received:",
            payload.new.balance,
          );
          return prev;
        }

        // Ensure the new balance is actually different
        const shouldUpdateBalance = newBalance !== currentBalance;

        if (shouldUpdateBalance) {
          toast.info(
            `${chainType.charAt(0).toUpperCase() + chainType.slice(1)} balance: ${newBalance} USDC`,
          );

          return {
            ...prev,
            [chainType]: {
              ...prev[chainType],
              token: newBalance,
            },
          };
        }
        return prev;
      });
    },
    [],
  );

  // Initialize balances when accounts change or on first load
  useEffect(() => {
    // Skip balance fetch if not initialized yet
    if (!isInitialized) return;

    // Check if accounts have changed or this is the first load
    const accountsChanged = haveAccountsChanged();
    const isFirstLoad = !balancesLoadedRef.current;

    // Check if we just logged in or created a wallet
    const freshInitialization =
      typeof window !== "undefined" &&
      localStorage.getItem("wallet_just_initialized");

    if (freshInitialization) {
      // Clear the flag
      localStorage.removeItem("wallet_just_initialized");

      // Reset the balances loaded flag
      balancesLoadedRef.current = false;

      // Add a small delay to ensure Web3Provider has fully initialized
      const timeoutId = setTimeout(() => {
        loadBalances();
      }, 1000);

      return () => clearTimeout(timeoutId);
    } else if (isFirstLoad || accountsChanged) {
      // Only load balances if this is the first load or if accounts have changed
      loadBalances();
    }
  }, [isConnected, isInitialized, loadBalances, haveAccountsChanged]);

  // Set up realtime subscription for wallet updates
  useEffect(() => {
    // Clean up any existing subscription
    if (realtimeChannelRef.current) {
      supabaseRef.current.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    // Skip if no wallets connected
    if (!accounts.polygon.address && !accounts.base.address) return;

    // Create a single channel for all wallet updates
    const walletChannel = supabaseRef.current
      .channel("wallet-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
        },
        (payload) => {
          // Determine which wallet was updated
          const address = payload.new.wallet_address.toLowerCase();
          const blockchain = payload.new.blockchain;

          if (
            blockchain === "BASE" &&
            address === accounts.base.address?.toLowerCase()
          ) {
            updateWalletBalance(payload, "base");
          } else if (
            blockchain === "POLYGON" &&
            address === accounts.polygon.address?.toLowerCase()
          ) {
            updateWalletBalance(payload, "polygon");
          }
        },
      )
      .subscribe();

    // Store the channel reference for cleanup
    realtimeChannelRef.current = walletChannel;

    // Clean up subscription on unmount or when addresses change
    return () => {
      if (realtimeChannelRef.current) {
        supabaseRef.current.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [accounts.polygon.address, accounts.base.address, updateWalletBalance]);

  return {
    balances,
    refreshBalances: loadBalances,
    isRefreshing: isRefreshingRef.current,
  };
}
