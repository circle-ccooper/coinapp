"use client";

import React, { createContext, useContext, ReactNode, MutableRefObject } from "react";
import { useWalletBalances } from "@/hooks/use-wallet-balances";

// Define the shape of our balance context
interface BalanceContextType {
  balances: {
    polygon: {
      native: number;
      token: number;
      loading: boolean;
    };
    base: {
      native: number;
      token: number;
      loading: boolean;
    };
  };
  isRefreshing: boolean;
  refreshBalances: () => Promise<void>;
}

// Create the context with a default value
const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

// Custom hook for using the balance context
export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error("useBalance must be used within a BalanceProvider");
  }
  return context;
}

// Balance Provider component
export function BalanceProvider({ children }: { children: ReactNode }) {
  // Use the existing hook
  const { balances, isRefreshing, refreshBalances } = useWalletBalances();

  // Create the value object once
  const value = {
    balances,
    isRefreshing,
    refreshBalances,
  };

  // Provide the balance context to all children
  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}