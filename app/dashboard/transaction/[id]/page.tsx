"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, X } from "lucide-react";
import Link from "next/link";

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export default function Transaction() {
  const router = useRouter();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the useParams hook instead of accessing props.params directly
  const params = useParams();
  const id = params.id as string;

  const searchParams = useSearchParams();
  const networkId = searchParams.get("networkId");

  const handleReturn = () => {
    router.push("/dashboard");
  };

  useEffect(() => {
    async function fetchTransaction() {
      if (!id) return;

      try {
        setLoading(true);
        // Make sure to include the networkId in the query if it exists
        const url = networkId
          ? `${baseUrl}/api/wallet/transactions/${id}?networkId=${networkId}`
          : `${baseUrl}/api/wallet/transactions/${id}`;

        const response = await fetch(url);
        const parsedResponse = await response.json();

        if (parsedResponse.error) {
          setError(parsedResponse.error);
          return;
        }

        setTransaction(parsedResponse.transaction);
      } catch (err) {
        console.error("Error fetching transaction:", err);
        setError("Failed to load transaction details");
      } finally {
        setLoading(false);
      }
    }

    fetchTransaction();
  }, [id, networkId, baseUrl]);

  if (loading) {
    return (
      <>
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-6 w-full mb-4" />
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-6 w-full mb-4" />
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-6 w-full mb-4" />
      </>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight text-red-700">
          Error Loading Transaction
        </h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        Invalid transaction
      </h2>
    );
  }

  // Safely format dates
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
      };
    } catch (e) {
      return { date: "Unknown", time: "" };
    }
  };

  const creation = formatDate(transaction.createDate);
  const lastUpdate = formatDate(transaction.updateDate);

  // Get status color
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower === "complete" || statusLower === "confirmed") {
      return "bg-green-100 text-green-800";
    } else if (
      statusLower === "pending" ||
      statusLower === "waiting_for_confirmation"
    ) {
      return "bg-yellow-100 text-yellow-800";
    } else if (statusLower === "failed") {
      return "bg-red-100 text-red-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="flex flex-col p-4 max-w-full overflow-y-auto h-full">
      {/* Header with back button */}
      <div className="sticky top-0 bg-background z-10 pb-2 mb-4 flex items-center">
        <Button
          onClick={handleReturn}
          variant="ghost"
          size="icon"
          className="mr-2"
        >
          <X className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold">Transaction Details</h2>
      </div>

      {/* Primary transaction info */}
      <div className="bg-muted/30 rounded-lg p-3 mb-4">
        <div className="flex justify-between items-center mb-3">
          <Badge className={`${getStatusColor(transaction.state)} px-2 py-1`}>
            {transaction.state?.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {transaction.transactionType?.replace(/_/g, " ")?.toUpperCase()}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Amount</span>
            <span className="text-sm font-medium">
              {transaction.amounts && transaction.amounts[0]
                ? `${transaction.amounts[0]} USDC`
                : "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Network</span>
            <span className="text-sm">
              {transaction.networkName || transaction.blockchain || "Unknown"}
            </span>
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <div>
            <span className="text-muted-foreground">Created:</span>
            <div>{creation.date}</div>
            <div>{creation.time}</div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Last Updated:</span>
            <div>{lastUpdate.date}</div>
            <div>{lastUpdate.time}</div>
          </div>
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="space-y-3">
        {/* IDs Section */}
        <details className="group rounded-lg border p-2">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
            <span className="text-sm font-medium">Transaction IDs</span>
            <div className="text-muted-foreground">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="pt-2 space-y-2">
            <div>
              <h4 className="text-xs text-muted-foreground">Transaction ID</h4>
              <p className="text-xs break-all mt-1">{transaction.id}</p>
            </div>

            {transaction.txHash && (
              <div className="mt-2">
                <h4 className="text-xs text-muted-foreground">
                  Transaction Hash
                </h4>
                <p className="text-xs break-all mt-1">{transaction.txHash}</p>
              </div>
            )}
          </div>
        </details>

        {/* Addresses Section */}
        <details className="group rounded-lg border p-2">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
            <span className="text-sm font-medium">Addresses</span>
            <div className="text-muted-foreground">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="pt-2 space-y-2">
            {transaction.from && (
              <div>
                <h4 className="text-xs text-muted-foreground">From</h4>
                <p className="text-xs break-all mt-1">{transaction.from}</p>
              </div>
            )}

            {transaction.to && (
              <div className="mt-2">
                <h4 className="text-xs text-muted-foreground">To</h4>
                <p className="text-xs break-all mt-1">{transaction.to}</p>
              </div>
            )}

            {transaction.walletId && (
              <div className="mt-2">
                <h4 className="text-xs text-muted-foreground">Wallet ID</h4>
                <p className="text-xs break-all mt-1">{transaction.walletId}</p>
              </div>
            )}

            {transaction.walletAddress && (
              <div className="mt-2">
                <h4 className="text-xs text-muted-foreground">
                  Wallet Address
                </h4>
                <p className="text-xs break-all mt-1">
                  {transaction.walletAddress}
                </p>
              </div>
            )}

            {transaction.tokenAddress && (
              <div className="mt-2">
                <h4 className="text-xs text-muted-foreground">Token Address</h4>
                <p className="text-xs break-all mt-1">
                  {transaction.tokenAddress}
                </p>
              </div>
            )}
          </div>
        </details>
        {/* External links section */}
        {transaction.txHash && (
          <div className="pt-2 space-y-2">
            {transaction.networkName === "Polygon Amoy" && (
              <Link
                href={`https://amoy.polygonscan.com/tx/${transaction.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full py-2 text-sm">
                  View on Polygon Scan
                </Button>
              </Link>
            )}

            {transaction.networkName === "Base Sepolia" && (
              <Link
                href={`https://sepolia.basescan.org/tx/${transaction.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full py-2 text-sm">
                  View on BaseScan
                </Button>
              </Link>
            )}
          </div>

        )}
      </div>
    </div>
  );
}
