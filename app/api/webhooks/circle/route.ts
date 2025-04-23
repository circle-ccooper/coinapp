import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { SupabaseClient } from "@supabase/supabase-js";

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

// Type definitions
interface Wallet {
  id: string;
  wallet_address: string;
  balance?: number;
  profile_id: string;
  [key: string]: any;
}

interface BaseNotification {
  state: string;
  walletId?: string;
  walletAddress?: string;
  amount?: string;
  tokenAddress?: string;
  blockchain?: string;
  txHash?: string;
}

interface TransfersNotification extends BaseNotification {
  id: string;
  source?: { address: string };
  destination?: { address: string };
}

interface ModularWalletNotification extends BaseNotification {
  from: string;
  to: string;
}

interface UserOperationNotification extends BaseNotification {
  id: string;
  sender: string;
  to: string;
  userOpHash: string;
}

type NotificationType =
  | "transfers"
  | "modularWallet.inboundTransfer"
  | "modularWallet.outboundTransfer"
  | "modularWallet.userOperation"
  | string;

type TransactionType = "USDC_TRANSFER_IN" | "USDC_TRANSFER_OUT";

type ChainType = "polygon" | "base";

// Improved findWalletByAddress function with client-side matching
async function findWalletByAddress(
  address: string,
  chainType: ChainType
): Promise<Wallet | null> {
  if (!address) {
    console.error("Attempted to find wallet with empty address");
    return null;
  }

  const supabase = await createSupabaseServerClient();

  // Normalize the address by trimming whitespace and converting to lowercase
  const normalizedAddress = address.trim().toLowerCase();

  // First get all wallets and check client-side
  // This bypasses any potential database-side comparison issues
  const { data: allWallets, error: allWalletsError } = await supabase
    .from("wallets")
    .select("*")
    .limit(50);

  if (allWalletsError) {
    console.error("Error fetching wallets:", allWalletsError);
    return null;
  }

  // Find the matching wallet by manual comparison
  if (allWallets && allWallets.length > 0) {
    // First try exact match
    const exactMatch = allWallets.find(
      (wallet) =>
        wallet.wallet_address.toLowerCase() === normalizedAddress &&
        wallet.blockchain === chainType.toUpperCase()
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Try without 0x prefix if original has it
    if (normalizedAddress.startsWith("0x")) {
      const withoutPrefix = normalizedAddress.substring(2);
      const prefixMatch = allWallets.find(
        (wallet) => wallet.wallet_address.toLowerCase() === withoutPrefix
      );

      if (prefixMatch) {
        return prefixMatch;
      }
    }
    // Try with 0x prefix if the original didn't have it
    else {
      const withPrefix = "0x" + normalizedAddress;
      const prefixMatch = allWallets.find(
        (wallet) => wallet.wallet_address.toLowerCase() === withPrefix
      );

      if (prefixMatch) {
        return prefixMatch;
      }
    }

    // If still not found, try removing any non-alphanumeric characters from both sides
    const cleanedAddress = normalizedAddress.replace(/[^a-f0-9]/g, "");
    const fuzzyMatch = allWallets.find(
      (wallet) =>
        wallet.wallet_address.toLowerCase().replace(/[^a-f0-9]/g, "") ===
        cleanedAddress
    );

    if (fuzzyMatch) {
      return fuzzyMatch;
    }
  }
  return null;
}

// Update wallet balance after transactions
async function updateWalletBalance(
  walletAddress: string,
  chainType: ChainType
): Promise<void> {
  if (!walletAddress) return;

  try {
    const wallet = await findWalletByAddress(walletAddress, chainType);
    if (!wallet) {
      return;
    }

    const supabase = await createSupabaseServerClient();

    // Call wallet balance API
    const response = await fetch(`${baseUrl}/api/wallet/balance`, {
      method: "POST",
      body: JSON.stringify({
        walletId: wallet.wallet_address,
        blockchain: chainType,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(`Balance API error: ${response.status}`);
      return;
    }

    const { balance } = await response.json();

    // Update wallet balance in database
    await supabase
      .from("wallets")
      .update({ balance })
      .eq("wallet_address", wallet.wallet_address)
      .eq("blockchain", chainType.toUpperCase());
  } catch (error) {
    console.error("Failed to update wallet balance:", error);
  }
}

// Process transaction once wallet is found
async function processTransaction(
  wallet: Wallet,
  transactionType: TransactionType,
  notification: BaseNotification,
  supabase: SupabaseClient
): Promise<void> {
  const { state, tokenAddress, amount, txHash, blockchain } = notification;

  if (!txHash) {
    console.error("Missing txHash in notification");
    return;
  }

  const chainType =
    notification.blockchain === "MATIC-AMOY" ? "polygon" : "base";

  // Check if transaction already exists
  const { data: existingTx, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("circle_transaction_id", txHash)
    .single();

  if (!txError && existingTx) {
    // Update existing transaction status if changed
    if (existingTx.status !== state) {
      await supabase
        .from("transactions")
        .update({ status: state })
        .eq("id", existingTx.id);
    }
  } else {
    // Create new transaction record
    const networkName = blockchain?.includes("MATIC")
      ? "Polygon Amoy"
      : "Base Sepolia";
    const networkId = blockchain?.includes("MATIC") ? 80002 : 421614;

    const { error: insertError } = await supabase.from("transactions").insert({
      transaction_type: transactionType,
      amount: amount || 0,
      status: state,
      currency: "USDC",
      wallet_id: wallet.id,
      profile_id: wallet.profile_id,
      circle_transaction_id: txHash,
      created_at: new Date().toISOString(),
      network_name: networkName,
      network_id: networkId,
      circle_contract_address: tokenAddress,
      description: `${transactionType === "USDC_TRANSFER_IN" ? "Received" : "Sent"} USDC via ${networkName || "blockchain"}`,
    });

    if (insertError) {
      console.error("Error creating transaction:", insertError);
    }
  }

  // Update balance for COMPLETE or CONFIRMED transactions
  if (state === "COMPLETE" || state === "CONFIRMED") {
    let walletAddress = notification.walletAddress;

    // Extract the address based on notification type
    if (!walletAddress) {
      if ("sender" in notification) {
        // UserOperation notification
        walletAddress = (notification as UserOperationNotification).sender;
      } else if ("from" in notification && "to" in notification) {
        // ModularWallet notification
        walletAddress =
          transactionType === "USDC_TRANSFER_IN"
            ? (notification as ModularWalletNotification).to
            : (notification as ModularWalletNotification).from;
      }
    }

    if (walletAddress) {
      await updateWalletBalance(walletAddress, chainType);
    }
  }
}

// Complete handleWebhookNotification function with userOperation support
async function handleWebhookNotification(
  notification:
    | TransfersNotification
    | ModularWalletNotification
    | UserOperationNotification,
  notificationType: NotificationType
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const chainType =
    notification.blockchain === "MATIC-AMOY" ? "polygon" : "base";

  try {
    // Handle Circle transfers
    if (notificationType === "transfers") {
      const transferNotification = notification as TransfersNotification;
      const { id, state } = transferNotification;

      if (!id) {
        console.error("Missing ID in transfers notification");
        return;
      }

      // Find and update existing transaction
      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .select()
        .eq("circle_transaction_id", id)
        .single();

      if (!txError && tx && tx.status !== state) {
        await supabase
          .from("transactions")
          .update({ status: state })
          .eq("id", tx.id);
      }

      // Update balance for completed transactions
      if (state === "COMPLETE" || state === "CONFIRMED") {
        // Prioritize the walletAddress field if available
        let walletAddress = notification.walletAddress;

        // Fall back to destination/source address if walletAddress isn't available
        if (!walletAddress) {
          walletAddress =
            transferNotification.destination?.address ||
            transferNotification.source?.address;
        }

        if (walletAddress) {
          await updateWalletBalance(walletAddress, chainType);
        }
      }

      return;
    }

    // Handle modular wallet user operations
    if (notificationType === "modularWallet.userOperation") {
      const userOpNotification = notification as UserOperationNotification;
      const { state, txHash, sender, to } = userOpNotification;

      // Skip incomplete transactions
      if (state !== "COMPLETE" && state !== "CONFIRMED") {
        return;
      }

      // Find wallet for sender (always the wallet we care about for userOperations)
      const wallet = await findWalletByAddress(sender, chainType);

      if (!wallet) {
        console.error(
          `Could not find a wallet for userOperation sender: ${sender}`
        );
        return;
      }

      // For userOperations, we'll create a transaction record
      // Determine the transaction type based on the contract interaction
      const transactionType: TransactionType = "USDC_TRANSFER_OUT"; // Assuming userOp is mostly for sending

      await processTransaction(
        wallet,
        transactionType,
        userOpNotification,
        supabase
      );

      // Update wallet balance after userOperation
      await updateWalletBalance(sender, chainType);

      return;
    }

    // Handle modular wallet transfers (inbound/outbound)
    if (notificationType.startsWith("modularWallet")) {
      const modularNotification = notification as ModularWalletNotification;
      const { state, txHash, from, to, walletAddress } = modularNotification;

      // Skip incomplete transactions
      if (state !== "COMPLETE" && state !== "CONFIRMED") {
        return;
      }

      // Determine transaction direction
      const isInbound = notificationType === "modularWallet.inboundTransfer";
      const transactionType: TransactionType = isInbound
        ? "USDC_TRANSFER_IN"
        : "USDC_TRANSFER_OUT";

      // Prioritize walletAddress field if it exists
      let relevantAddress = walletAddress;

      // If walletAddress is not available, use from/to based on direction
      if (!relevantAddress) {
        relevantAddress = isInbound ? to : from;
      }

      // Skip if no valid address found
      if (!relevantAddress) {
        console.error(
          `No valid address found in notification for ${transactionType}`
        );
        return;
      }

      // Find wallet
      const wallet = await findWalletByAddress(relevantAddress, chainType);

      if (!wallet) {
        // Try fallback with alternative addresses
        const fallbackAddresses = [
          isInbound ? from : to, // Try the other direction address
          walletAddress, // Try explicit wallet address if not already tried
        ].filter((addr) => addr && addr !== relevantAddress); // Filter out undefined and already tried addresses

        for (const fallbackAddress of fallbackAddresses) {
          if (!fallbackAddress) continue; // Skip undefined addresses

          const fallbackWallet = await findWalletByAddress(
            fallbackAddress,
            chainType
          );

          if (fallbackWallet) {
            await processTransaction(
              fallbackWallet,
              transactionType,
              modularNotification,
              supabase
            );
            return;
          }
        }

        console.error(
          `Could not find a wallet for address: ${relevantAddress} or any fallbacks`
        );
        return;
      }

      await processTransaction(
        wallet,
        transactionType,
        modularNotification,
        supabase
      );
    }
  } catch (error) {
    console.error("Error processing notification:", error);
  }
}

// Verify Circle's signature
async function verifyCircleSignature(
  bodyString: string,
  signature: string,
  keyId: string
): Promise<boolean> {
  try {
    const publicKey = await getCirclePublicKey(keyId);

    const verifier = crypto.createVerify("SHA256");
    verifier.update(bodyString);
    verifier.end();

    const signatureBytes = Uint8Array.from(Buffer.from(signature, "base64"));
    return verifier.verify(publicKey, signatureBytes);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Get Circle's public key
async function getCirclePublicKey(keyId: string): Promise<string> {
  if (!process.env.CIRCLE_API_KEY) {
    throw new Error("Circle API key is not set");
  }

  const response = await fetch(
    `https://api.circle.com/v2/notifications/publicKey/${keyId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch public key: ${response.statusText}`);
  }

  const data = await response.json();
  const rawPublicKey = data.data.publicKey;

  // Convert to PEM format
  return `-----BEGIN PUBLIC KEY-----\n${rawPublicKey.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
}

// Main webhook handler
export async function POST(req: NextRequest) {
  try {
    // Verify headers
    const signature = req.headers.get("x-circle-signature");
    const keyId = req.headers.get("x-circle-key-id");

    if (!signature || !keyId) {
      return NextResponse.json(
        { error: "Missing signature or keyId" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const bodyString = JSON.stringify(body);

    // Verify signature
    const isVerified = await verifyCircleSignature(
      bodyString,
      signature,
      keyId
    );
    if (!isVerified) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    // Process notification
    await handleWebhookNotification(body.notification, body.notificationType);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to process webhook:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process notification: ${message}` },
      { status: 500 }
    );
  }
}

// Handle HEAD requests
export async function HEAD() {
  return NextResponse.json({}, { status: 200 });
}
