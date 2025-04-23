"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Wallet } from "@/types/database.types";
import { useEffect, useMemo, useState, type FunctionComponent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Badge } from "@/components/ui/badge";
import { polygonAmoy, baseSepolia } from 'viem/chains';
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

// Simple transaction format from API
interface SimpleTransaction {
  hash: string;
  from: string;
  to: string;
  toAddress?: string;
  fromAddress?: string;
  amount: string;
  timestamp: string;
  networkId: number;
  networkName: string;
  state: string;
  transactionType: string;
  id: string;
}

// Response type for the transfers API
interface TransfersResponse {
  transactions: SimpleTransaction[];
  pagination: {
    hasMore: boolean;
    pageAfter?: string;
    pageBefore?: string;
  };
  error?: string;
}

// Database transaction type
interface Transaction {
  id: string;
  status: string;
  created_at: string;
  circle_transaction_id: string;
  circle_contract_address: string;
  transaction_type: string;
  amount: string;
  network_id: number;
  network_name: string;
}

interface Props {
  wallet: Wallet;
  profile: {
    id: any;
  } | null;
}

const NETWORK_COLORS: Record<number, string> = {
  [polygonAmoy.id]: "bg-purple-100",
  [baseSepolia.id]: "bg-blue-100",
};

async function syncTransactions(
  supabase: SupabaseClient,
  walletId: string,
  profileId: string,
  circleWalletId: string
) {
  try {
    // Check for both networks - first Polygon Amoy
    const polygonResponse = await fetch(
      `${baseUrl}/api/wallet/transactions`,
      {
        method: "POST",
        body: JSON.stringify({
          walletId: circleWalletId,
          networkId: polygonAmoy.id,
          pageSize: 50 // Get maximum number of transactions
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Then Base Sepolia
    const baseResponse = await fetch(
      `${baseUrl}/api/wallet/transactions`,
      {
        method: "POST",
        body: JSON.stringify({
          walletId: circleWalletId,
          networkId: baseSepolia.id,
          pageSize: 50
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Parse responses
    let polygonTransactions: SimpleTransaction[] = [];
    let baseTransactions: SimpleTransaction[] = [];

    if (polygonResponse.ok) {
      const data: TransfersResponse = await polygonResponse.json();
      polygonTransactions = data.transactions || [];
    } else {
      console.error("Polygon API response error:", await polygonResponse.json());
    }

    if (baseResponse.ok) {
      const data: TransfersResponse = await baseResponse.json();
      baseTransactions = data.transactions || [];
    } else {
      console.error("Base API response error:", await baseResponse.json());
    }

    // Combine all transactions
    const allTransactions = [...polygonTransactions, ...baseTransactions];

    if (allTransactions.length === 0) {
      // Even if no new transactions, return existing ones from the database
      const { data: existingTransactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false });

      return existingTransactions || [];
    }

    // Get existing transactions from database
    const { data: existingTransactions, error: fetchError } = await supabase
      .from("transactions")
      .select("circle_transaction_id")
      .eq("wallet_id", walletId);

    if (fetchError) {
      console.error("Error fetching existing transactions:", fetchError);
      return [];
    }

    const existingTransactionIds = new Set(
      existingTransactions?.map((t: any) => t.circle_transaction_id) || []
    );

    // Filter out transactions that already exist
    const newTransactions = allTransactions.filter(
      (tx) => !existingTransactionIds.has(tx.hash)
    );

    // Insert new transactions into the database
    if (newTransactions.length > 0) {
      const transactionsToInsert = newTransactions.map(tx => {
        let parsedAmount = 0;
        try {
          parsedAmount = parseFloat(tx.amount) || 0;
        } catch (e) {
          console.error("Error parsing amount:", tx.amount, e);
        }

        // Handle different field naming conventions with null checks
        const toAddress = tx.to || tx.toAddress || "";
        const fromAddress = tx.from || tx.fromAddress || "";

        // Only compare if both values exist and are not empty
        const isReceived = toAddress && circleWalletId ?
          toAddress.toLowerCase() === circleWalletId.toLowerCase() :
          false;

        const transactionType = isReceived ? "USDC_TRANSFER" : "OUTBOUND";

        // Create database record
        return {
          wallet_id: walletId,
          profile_id: profileId,
          circle_transaction_id: tx.id,
          transaction_type: tx.transactionType || transactionType,
          amount: parsedAmount,
          currency: "USDC",
          status: tx.state || "CONFIRMED",
          created_at: tx.timestamp,
          network_id: tx.networkId,
          network_name: tx.networkName,
          circle_contract_address: isReceived ? fromAddress : toAddress,
        };
      });

      try {
        const { error: insertError } = await supabase
          .from("transactions")
          .insert(transactionsToInsert);

        if (insertError) {
          console.error("Error inserting transactions:", insertError);
        }
      } catch (err) {
        console.error("Exception during insert:", err);
      }
    }

    // Return all transactions from database
    const { data: allDbTransactions, error: finalFetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false });

    if (finalFetchError) {
      console.error("Error in final transaction fetch:", finalFetchError);
      return [];
    }

    // Filter out duplicates
    const uniqueTransactions = allDbTransactions?.reduce((acc, current) => {
      const existingTransaction = acc.find(
        (item: { circle_transaction_id: any }) =>
          item.circle_transaction_id === current.circle_transaction_id
      );
      if (!existingTransaction) {
        acc.push(current);
      }
      return acc;
    }, []) || [];

    return uniqueTransactions;
  } catch (error) {
    console.error("Error in syncTransactions:", error);
    return [];
  }
}

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

const supabase = createSupabaseBrowserClient();

export const Transactions: FunctionComponent<Props> = (props) => {
  const router = useRouter();
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNetworkFilter, setActiveNetworkFilter] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Remove pagination related state
  const formattedData = useMemo(
    () =>
      data.map((transaction) => ({
        ...transaction,
        created_at: new Date(transaction.created_at).toISOString(), // Keep as ISO string for grouping
        formattedDate: "", // Will be populated in the next step
      })),
    [data]
  );

  const filteredData = useMemo(() => {
    if (activeNetworkFilter === null) return formattedData;
    return formattedData.filter(tx =>
      tx.network_id === activeNetworkFilter ||
      (activeNetworkFilter === polygonAmoy.id && !tx.network_id))
  }, [formattedData, activeNetworkFilter]);

  const searchedData = useMemo(() => {
    if (!searchQuery) return filteredData;
    const query = searchQuery.toLowerCase();
    return filteredData.filter(tx =>
      tx.circle_transaction_id.toLowerCase().includes(query)
    );
  }, [filteredData, searchQuery]);

  // Group transactions by month
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof filteredData> = {};
    const now = new Date();

    searchedData.forEach((transaction) => {
      const date = new Date(transaction.created_at);

      // Format month header
      let monthKey: string;
      if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        monthKey = "This month";
      } else {
        monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      }

      // Format transaction date
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      transaction.formattedDate = diffDays <= 7
        ? date.toLocaleDateString('en-US', { weekday: 'long' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey]!.push(transaction);
    });

    // Sort groups by date descending
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const dateA = a === "This month" ? now : new Date(a);
      const dateB = b === "This month" ? now : new Date(b);
      return dateB.getTime() - dateA.getTime();
    });

    const sortedGroups: Record<string, typeof filteredData> = {};
    sortedKeys.forEach(key => sortedGroups[key] = groups[key]!);
    return sortedGroups;
  }, [searchedData]);

  // Transaction type display mapping
  const getTransactionTypeDisplay = (type: string) => {
    if (type === "USDC_TRANSFER_IN" || type === "received") {
      return "Payment received"
    }

    if (type === "USDC_TRANSFER_OUT" || type === "sent") {
      return "Payment sent"
    }

    return type
  };

  const updateTransactions = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      setError(null);

      if (!props.wallet?.id || !props.profile?.id || !props.wallet?.circle_wallet_id) {
        setError("Missing wallet or profile information");
        return;
      }

      // Sync and get transactions
      const transactions = await syncTransactions(
        supabase,
        props.wallet.id,
        props.profile.id,
        props.wallet.circle_wallet_id
      );

      setData(transactions);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleNetworkFilter = (networkId: number) => {
    if (activeNetworkFilter === networkId) {
      setActiveNetworkFilter(null); // Clear filter if already active
    } else {
      setActiveNetworkFilter(networkId); // Set new filter
    }
  };

  useEffect(() => {
    if (!props.wallet?.id || !props.profile?.id) {
      return;
    }

    const transactionSubscription = supabase
      .channel("transactions")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
          filter: `profile_id=eq.${props.profile?.id}`,
        },
        () => updateTransactions()
      )
      .subscribe();

    updateTransactions();

    return () => {
      supabase.removeChannel(transactionSubscription);
    };
  }, [props.wallet?.id, props.profile?.id, props.wallet?.circle_wallet_id]);

  if (loading) {
    return <Skeleton className="w-full h-[30px] rounded-md" />;
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-800">
        <p>Error loading transactions: {error}</p>
        <button
          onClick={updateTransactions}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0 || (activeNetworkFilter && filteredData.length === 0)) {
    return (
      <>
        <div className="flex flex-col justify-between mb-4">
          <Input
            placeholder="Search transactions..."
            className="w-full mb-2"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />
          <div className="flex gap-2">
            <Badge
              className={`cursor-pointer ${activeNetworkFilter === polygonAmoy.id ? NETWORK_COLORS[polygonAmoy.id] : 'bg-gray-100 text-gray-800'}`}
              onClick={() => toggleNetworkFilter(polygonAmoy.id)}
            >
              Polygon Amoy
            </Badge>
            <Badge
              className={`cursor-pointer ${activeNetworkFilter === baseSepolia.id ? NETWORK_COLORS[baseSepolia.id] : 'bg-gray-100 text-gray-800'}`}
              onClick={() => toggleNetworkFilter(baseSepolia.id)}
            >
              Base Sepolia
            </Badge>
          </div>
        </div>
        <p className="text-xl text-muted-foreground">
          No transactions found
        </p>
      </>
    );
  }

  return (
    <>
      <Input
        placeholder="Search transactions..."
        className="w-full mb-2"
        value={searchQuery}
        onChange={event => setSearchQuery(event.target.value)}
      />
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Badge
            className={`cursor-pointer ${activeNetworkFilter === polygonAmoy.id ? NETWORK_COLORS[polygonAmoy.id] : 'bg-gray-100 text-gray-800'}`}
            onClick={() => toggleNetworkFilter(polygonAmoy.id)}
          >
            Polygon Amoy
          </Badge>
          <Badge
            className={`cursor-pointer ${activeNetworkFilter === baseSepolia.id ? NETWORK_COLORS[baseSepolia.id] : 'bg-gray-100 text-gray-800'}`}
            onClick={() => toggleNetworkFilter(baseSepolia.id)}
          >
            Base Sepolia
          </Badge>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedTransactions).map(([month, transactions]) => (
          <div key={month}>
            <h2 className="text-xl font-bold mb-2">{month}</h2>
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const statusClass = transaction.status === "CONFIRMED" || transaction.status === "COMPLETE"
                  ? "bg-green-100 text-green-800"
                  : transaction.status === "PENDING" || transaction.status === "WAITING_FOR_CONFIRMATION"
                    ? "bg-yellow-100 text-yellow-800"
                    : transaction.status === "FAILED"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800";

                return (
                  <div
                    key={transaction.id}
                    className="p-4 pl-0 hover:bg-gray-50 dark:hover:bg-white/5"
                    onClick={() => router.push(
                      `/dashboard/transaction/${transaction.circle_transaction_id}?networkId=${transaction.network_id || polygonAmoy.id}`
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium">
                            {transaction.circle_transaction_id ?
                              `${transaction.circle_transaction_id.slice(0, 6)}...${transaction.circle_transaction_id.slice(-4)}` :
                              'Unknown address'}
                          </span>
                          <Badge className={`ml-2 ${statusClass}`}>
                            {transaction.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {getTransactionTypeDisplay(transaction.transaction_type)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.formattedDate}
                        </div>
                      </div>
                      <div className="ml-auto font-medium">
                        {(transaction.transaction_type === 'USDC_TRANSFER_IN' ||
                          transaction.transaction_type === 'received') ? '+' : '-'}
                        {transaction.amount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};