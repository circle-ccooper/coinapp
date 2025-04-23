"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useWeb3 } from "@/components/web3-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import StripeOnrampDialog from "@/components/stripe-onramp-dialog";
import { useBalance } from "@/contexts/balanceContext";

export function WalletBalance() {
  const { activeChain, setActiveChain } = useWeb3();
  const { balances, isRefreshing, refreshBalances } = useBalance();
  const [onrampDialogOpen, setOnrampDialogOpen] = useState(false);

  const handleRefreshBalances = useCallback(async () => {
    try {
      await refreshBalances();
      toast.success("Balances refreshed");
    } catch (error) {
      console.error("Error refreshing balances:", error);
      toast.error("Failed to refresh balances");
    }
  }, [refreshBalances]);

  // Format balance for display
  interface BalanceFormatProps {
    value: number;
    loading: boolean;
  }

  const formatBalance = ({ value, loading }: BalanceFormatProps): React.ReactNode => {
    if (loading) {
      return <Skeleton className="h-8 w-24" />;
    }

    // Make sure we have a valid number
    const formattedBalance = (isNaN(value) || value === 0) ? "0" : value.toFixed(2);

    return `${formattedBalance} USDC`;
  };

  return (
    <>
      <Tabs
        defaultValue={activeChain}
        onValueChange={value => setActiveChain(value as "polygon" | "base")}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="polygon">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              Polygon
            </div>
          </TabsTrigger>
          <TabsTrigger value="base">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Base
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="polygon" className="mt-4">
          <div className="text-3xl font-bold">
            {formatBalance({ value: balances.polygon.token, loading: balances.polygon.loading })}
          </div>
        </TabsContent>

        <TabsContent value="base" className="mt-4">
          <div className="text-3xl font-bold">
            {formatBalance({ value: balances.base.token, loading: balances.base.loading })}
          </div>
        </TabsContent>
      </Tabs>

      <button
        onClick={handleRefreshBalances}
        disabled={isRefreshing}
        className={`text-sm ${isRefreshing ? 'text-gray-400' : 'text-blue-500 hover:text-blue-700'} flex items-center gap-1`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isRefreshing ? 'animate-spin' : ''}
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
        {isRefreshing ? 'Refreshing...' : 'Refresh Balances'}
      </button>
      <StripeOnrampDialog open={onrampDialogOpen} onOpenChange={setOnrampDialogOpen} />
    </>
  );
}