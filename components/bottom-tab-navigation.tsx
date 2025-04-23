"use client";
import { type MouseEventHandler, useEffect, useMemo, useState } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User } from "@supabase/supabase-js";
import { History, Wallet } from "lucide-react";
import { createClient } from "@/lib/utils/supabase/client";
import millify from "millify";
import { useWeb3 } from "@/components/web3-provider";
import { usePathname, useRouter } from "next/navigation";
import { useBalance } from "@/contexts/balanceContext";
import { toast } from "sonner";

export default function BottomTabNavigation() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>();
  const { activeChain, accounts } = useWeb3();
  const { balances: web3Balances, refreshBalances, isRefreshing } = useBalance();
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange: MouseEventHandler<HTMLButtonElement> = (event) => {
    const transactionDetailsRouteRegex =
      /^\/dashboard\/transaction\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const isOnTransactionDetailsRoute =
      transactionDetailsRouteRegex.test(pathname);
    if (!isOnTransactionDetailsRoute) return;
    router.push("/dashboard");
  };

  // Simplified balance loading effect
  useEffect(() => {
    const loadInitialBalances = async () => {
      if ((accounts.polygon.address || accounts.base.address) && !isRefreshing) {
        try {
          await refreshBalances();
        } catch (error) {
          toast.error("Failed to refresh balances");
        }
      }
    };

    loadInitialBalances();
  }, [accounts.polygon.address, accounts.base.address]); // Only run when addresses change

  // Memoized balance formatting
  const formattedWalletBalance = useMemo(() => {
    const chainBalance = web3Balances[activeChain]?.token || 0;

    if (isNaN(chainBalance)) return "0";

    try {
      return millify(chainBalance, { precision: 2 });
    } catch (error) {
      console.error("Error formatting balance:", error);
      return "0";
    }
  }, [activeChain, web3Balances]);

  const getUser = async () => {
    const {
      data: { user: loggedUser },
    } = await supabase.auth.getUser();
    setUser(loggedUser);
  };

  useEffect(() => {
    if (user?.user_metadata.wallet_setup_complete) return;
    getUser();
  }, [user]);

  if (!user?.user_metadata.wallet_setup_complete) return null;

  return (
    <TabsList className="absolute bottom-0 left-0 grid w-full grid-cols-3 h-auto p-2">
      <TabsTrigger onClick={handleTabChange} value="balance">
        <p className="text-lg">${formattedWalletBalance}</p>
      </TabsTrigger>
      <TabsTrigger value="wallet">
        <Wallet />
      </TabsTrigger>
      <TabsTrigger value="transactions">
        <History />
      </TabsTrigger>
    </TabsList>
  );
}