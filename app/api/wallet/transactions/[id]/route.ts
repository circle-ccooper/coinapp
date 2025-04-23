import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { polygonAmoy, baseSepolia } from "viem/chains";

// Map our network IDs to Circle's blockchain names
const NETWORK_TO_BLOCKCHAIN: Record<number, string> = {
  [polygonAmoy.id]: "MATIC-AMOY",
  [baseSepolia.id]: "BASE-SEPOLIA",
};

// Network names for display
const NETWORK_NAMES: Record<number, string> = {
  [polygonAmoy.id]: "Polygon Amoy",
  [baseSepolia.id]: "Base Sepolia",
};

export async function GET(
  req: NextRequest,
  props: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = props.params;
    // Get network ID from query parameter or default to Polygon Amoy
    const url = new URL(req.url);
    const networkId = parseInt(
      url.searchParams.get("networkId") || String(polygonAmoy.id)
    );
    // Make sure we support the requested network
    if (!NETWORK_TO_BLOCKCHAIN[networkId]) {
      return NextResponse.json(
        { error: `Unsupported network ID: ${networkId}` },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createSupabaseServerClient();

    // First check if we have this transaction in our local database
    // We need to handle transaction hashes differently than UUIDs
    let localTransaction = null;

    // First check if the ID is a transaction hash (0x...)
    if (id.startsWith("0x")) {
      // Search by circle_transaction_id for transaction hashes
      const { data: txByHash, error: txByHashError } = await supabase
        .from("transactions")
        .select(
          `
          id, 
          wallet_id,
          profile_id,
          transaction_type,
          amount,
          currency,
          status,
          circle_transaction_id,
          created_at,
          description,
          circle_contract_address,
          network_id,
          network_name,
          wallets (wallet_address),
          profiles (*)
        `
        )
        .eq("circle_transaction_id", id)
        .single();

      if (txByHashError && txByHashError.code !== "PGRST116") {
        // PGRST116 is "not found"
        console.error(
          "Database error when searching by txHash:",
          txByHashError
        );
      } else if (txByHash) {
        localTransaction = txByHash;
      }
    } else {
      // Try looking up by UUID if not a transaction hash
      try {
        const { data: txByUuid, error: txByUuidError } = await supabase
          .from("transactions")
          .select(
            `
            id, 
            wallet_id,
            profile_id,
            transaction_type,
            amount,
            currency,
            status,
            circle_transaction_id,
            created_at,
            description,
            circle_contract_address,
            network_id,
            network_name,
            wallets (wallet_address),
            profiles (*)
          `
          )
          .eq("id", id)
          .single();

        if (txByUuidError && txByUuidError.code !== "PGRST116") {
          console.error(
            "Database error when searching by UUID:",
            txByUuidError
          );
        } else if (txByUuid) {
          localTransaction = txByUuid;
        }
      } catch (e) {
        console.error("Error parsing UUID:", e);
      }
    }

    // If we found the transaction in our database, return it
    if (localTransaction) {
      // Format the transaction from our database schema to the expected response format
      const transaction = {
        id: localTransaction.id,
        amounts: [localTransaction.amount?.toString() || "0"],
        state: (localTransaction.status || "unknown").toLowerCase(),
        createDate: localTransaction.created_at || new Date().toISOString(),
        blockchain:
          NETWORK_TO_BLOCKCHAIN[localTransaction.network_id || networkId] ||
          NETWORK_TO_BLOCKCHAIN[networkId],
        transactionType: (
          localTransaction.transaction_type || "transfer"
        ).toLowerCase(),
        updateDate: localTransaction.created_at || new Date().toISOString(),
        description:
          localTransaction.description ||
          `${localTransaction.transaction_type || "Transfer"} on ${localTransaction.network_name || NETWORK_NAMES[networkId]}`,
        networkId: localTransaction.network_id || networkId,
        networkName: localTransaction.network_name || NETWORK_NAMES[networkId],
        // These fields might not be in our db schema, try to get them from related data
        from: localTransaction.wallets?.[0]?.wallet_address || "Unknown",
        to: "Unknown", // We would need to store the recipient address in our schema
        gasUsed: "N/A", // We don't store this in our schema
        gasPrice: "N/A", // We don't store this in our schema
        txHash: localTransaction.circle_transaction_id || "",
        walletId: localTransaction.wallet_id || "",
        walletAddress: localTransaction.wallets?.[0]?.wallet_address || "",
        tokenAddress: localTransaction.circle_contract_address || "",
      };

      return NextResponse.json({ transaction });
    }

    // If not found in database, proceed with Circle API calls as before
    // First try direct transfer lookup by ID
    const transferUrl = `https://api.circle.com/v1/w3s/buidl/transfers/${id}`;
    const transferResponse = await fetch(transferUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      },
    });

    if (transferResponse.ok) {
      const transferData = await transferResponse.json();

      // Check if we have valid response data
      if (transferData.data && transferData.data.transfer) {
        const transfer = transferData.data.transfer;
        // Transform to our expected format
        const transaction = {
          id: transfer.id,
          amounts: [transfer.amount || "0"],
          state: (transfer.state || "unknown").toLowerCase(),
          createDate: transfer.createDate || new Date().toISOString(),
          blockchain: transfer.blockchain || NETWORK_TO_BLOCKCHAIN[networkId],
          transactionType: (transfer.transferType || "transfer").toLowerCase(),
          updateDate: transfer.updateDate || new Date().toISOString(),
          description: `${transfer.transferType || "Transfer"} on ${transfer.blockchain || NETWORK_NAMES[networkId]}`,
          networkId: networkId,
          networkName: NETWORK_NAMES[networkId],
          from: transfer.from || "Unknown",
          to: transfer.to || "Unknown",
          gasUsed: "N/A", // Not provided in this endpoint
          gasPrice: "N/A", // Not provided in this endpoint
          txHash: transfer.txHash || "",
          walletId: transfer.walletId || "",
          walletAddress: transfer.walletAddress || "",
          tokenAddress: transfer.tokenAddress || "",
        };

        // Try to store this transaction data in our database for future queries
        try {
          // Get wallet from wallet address
          const { data: wallet } = await supabase
            .from("wallets")
            .select("id, profile_id")
            .eq("wallet_address", transfer.walletAddress || transfer.from)
            .maybeSingle();

          if (wallet) {
            const { error: insertError } = await supabase
              .from("transactions")
              .insert({
                id: transfer.id, // Use the Circle transaction ID as our primary key
                wallet_id: wallet.id,
                profile_id: wallet.profile_id,
                transaction_type: transfer.transferType || "transfer",
                amount: parseFloat(transfer.amount || "0"),
                currency: "USDC", // Assuming USDC for now
                status: transfer.state || "unknown",
                circle_transaction_id: transfer.txHash || transfer.id,
                description: `${transfer.transferType || "Transfer"} on ${transfer.blockchain || NETWORK_NAMES[networkId]}`,
                circle_contract_address: transfer.tokenAddress || "",
                network_id: networkId,
                network_name: NETWORK_NAMES[networkId],
              });

            if (insertError) {
              console.warn(
                "Error inserting transaction to database:",
                insertError
              );
            }
          } else {
            console.warn(
              "Could not find wallet for transaction, not storing in database"
            );
          }
        } catch (dbError) {
          console.warn("Database error while storing transaction:", dbError);
        }

        return NextResponse.json({ transaction });
      }
    }

    // If not found by direct ID, try searching by txHash
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    const isTransactionHash = txHashRegex.test(id);

    if (isTransactionHash) {
      // Try looking up by transaction hash
      const transferByHashUrl = `https://api.circle.com/v1/w3s/buidl/transfers?txHash=${id}`;
      const transferByHashResponse = await fetch(transferByHashUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
        },
      });

      if (transferByHashResponse.ok) {
        const transfersData = await transferByHashResponse.json();

        if (
          transfersData.data &&
          transfersData.data.transfers &&
          transfersData.data.transfers.length > 0
        ) {
          const transfer = transfersData.data.transfers[0];
          // Transform to our expected format
          const transaction = {
            id: transfer.id,
            amounts: [transfer.amount || "0"],
            state: (transfer.state || "unknown").toLowerCase(),
            createDate: transfer.createDate || new Date().toISOString(),
            blockchain: transfer.blockchain || NETWORK_TO_BLOCKCHAIN[networkId],
            transactionType: (
              transfer.transferType || "transfer"
            ).toLowerCase(),
            updateDate: transfer.updateDate || new Date().toISOString(),
            description: `${transfer.transferType || "Transfer"} on ${transfer.blockchain || NETWORK_NAMES[networkId]}`,
            networkId: networkId,
            networkName: NETWORK_NAMES[networkId],
            from: transfer.from || transfer.fromAddress || "Unknown",
            to: transfer.to || transfer.toAddress || "Unknown",
            gasUsed: "N/A",
            gasPrice: "N/A",
            txHash: transfer.txHash || "",
            walletId: transfer.walletId || "",
            walletAddress: transfer.walletAddress || "",
            tokenAddress: transfer.tokenAddress || "",
          };

          // Try to store this transaction in our database
          try {
            // Get wallet from wallet address
            const { data: wallet } = await supabase
              .from("wallets")
              .select("id, profile_id")
              .eq(
                "wallet_address",
                transfer.walletAddress || transfer.from || transfer.fromAddress
              )
              .maybeSingle();

            if (wallet) {
              const { error: insertError } = await supabase
                .from("transactions")
                .insert({
                  id: transfer.id,
                  wallet_id: wallet.id,
                  profile_id: wallet.profile_id,
                  transaction_type: transfer.transferType || "transfer",
                  amount: parseFloat(transfer.amount || "0"),
                  currency: "USDC",
                  status: transfer.state || "unknown",
                  circle_transaction_id: transfer.txHash || transfer.id,
                  description: `${transfer.transferType || "Transfer"} on ${transfer.blockchain || NETWORK_NAMES[networkId]}`,
                  circle_contract_address: transfer.tokenAddress || "",
                  network_id: networkId,
                  network_name: NETWORK_NAMES[networkId],
                });

              if (insertError) {
                console.warn(
                  "Error inserting transaction to database:",
                  insertError
                );
              }
            }
          } catch (dbError) {
            console.warn("Database error while storing transaction:", dbError);
          }

          return NextResponse.json({ transaction });
        }
      }

      // If not found, try transaction-receipt API as last resort
      const blockchain = NETWORK_TO_BLOCKCHAIN[networkId];
      const receiptUrl = `https://api.circle.com/v1/w3s/buidl/transactions/${blockchain}/${id}/receipt`;

      const receiptResponse = await fetch(receiptUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
        },
      });

      if (receiptResponse.ok) {
        const receiptData = await receiptResponse.json();

        if (receiptData.data) {
          const receipt = receiptData.data;
          // Use the transaction receipt to build our response
          const transaction = {
            id: receipt.transactionHash || id,
            amounts: ["0"], // Without transfer data, we don't know the amount
            state: receipt.status === "0x1" ? "confirmed" : "failed",
            createDate: new Date().toISOString(), // Receipt doesn't include timestamp
            blockchain: blockchain,
            transactionType: "contract_interaction", // Default when we only have receipt
            updateDate: new Date().toISOString(),
            description: `Transaction on ${NETWORK_NAMES[networkId]}`,
            networkId: networkId,
            networkName: NETWORK_NAMES[networkId],
            from: receipt.from || "Unknown",
            to: receipt.to || "Unknown",
            gasUsed: receipt.gasUsed || "N/A",
            gasPrice: receipt.effectiveGasPrice || "N/A",
            txHash: receipt.transactionHash || id,
          };

          // Try to identify the wallet and store minimal transaction info
          try {
            const { data: wallet } = await supabase
              .from("wallets")
              .select("id, profile_id")
              .eq("wallet_address", receipt.from)
              .maybeSingle();

            if (wallet) {
              const { error: insertError } = await supabase
                .from("transactions")
                .insert({
                  id: receipt.transactionHash || id,
                  wallet_id: wallet.id,
                  profile_id: wallet.profile_id,
                  transaction_type: "contract_interaction",
                  amount: 0, // We don't know the amount
                  currency: "UNKNOWN",
                  status: receipt.status === "0x1" ? "confirmed" : "failed",
                  circle_transaction_id: receipt.transactionHash || id,
                  description: `Transaction on ${NETWORK_NAMES[networkId]}`,
                  network_id: networkId,
                  network_name: NETWORK_NAMES[networkId],
                });

              if (insertError) {
                console.warn(
                  "Error inserting minimal transaction to database:",
                  insertError
                );
              }
            }
          } catch (dbError) {
            console.warn(
              "Database error while storing minimal transaction:",
              dbError
            );
          }

          return NextResponse.json({ transaction });
        }
      }
    }

    // If we couldn't find the transaction on any API, return not found
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error fetching transaction:", error);

    // Check if this is a timeout or RPC error and handle it specially
    if (error instanceof Error) {
      console.error("API Error in transaction fetch:", error.message);

      // Parse user-friendly error message
      let userError = "Network request failed";

      if (error.message.includes("timeout")) {
        userError = "Request timed out. The service may be congested.";
      } else if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: userError }, { status: 503 });
    }

    return NextResponse.json(
      { error: "Internal server error while fetching transaction" },
      { status: 500 }
    );
  }
}
