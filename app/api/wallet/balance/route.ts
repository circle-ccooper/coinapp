import { type NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

// Schema validation
const WalletIdSchema = z.object({
  walletId: z.string(),
  blockchain: z.enum(["polygon", "base"]),
});

const ResponseSchema = z.object({
  balance: z.string().optional(),
  error: z.string().optional(),
});

type WalletBalanceResponse = z.infer<typeof ResponseSchema>;

export async function POST(
  req: NextRequest,
): Promise<NextResponse<WalletBalanceResponse>> {
  try {
    const body = await req.json();
    const parseResult = WalletIdSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid walletId format" },
        { status: 400 },
      );
    }

    const { walletId } = parseResult.data;
    const normalizedWalletId = walletId.toLowerCase();
    const normalizedNetwork = parseResult.data.blockchain.toUpperCase();

    // Get the Supabase client
    const supabase = await createSupabaseServerClient();

    // Fetch the wallet information from the database
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("wallet_address", normalizedWalletId)
      .eq("blockchain", normalizedNetwork)
      .single();

    if (walletError || !wallet) {
      console.error("Error fetching wallet:", walletError);
      return NextResponse.json(
        { error: "Wallet not found in database" },
        { status: 404 },
      );
    }

    // Get the wallet address and network information
    const walletAddress = wallet.wallet_address;

    if (!walletAddress) {
      console.error("Wallet address not found in database record");
      return NextResponse.json(
        { error: "Wallet address not found in database record" },
        { status: 400 },
      );
    }

    const networkName = wallet.blockchain;
    const blockchain = determineBlockchain(networkName);

    try {
      // Use the blockchain + address endpoint to get balances
      const balanceResponse = await axios.get(
        `https://api.circle.com/v1/w3s/buidl/wallets/${blockchain}/${walletAddress}/balances`,
        {
          headers: {
            "X-Request-Id": crypto.randomUUID(),
            Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      // FIXED: Extract from data.tokenBalances instead of tokenBalances
      // The Circle API wraps the response in a data object
      const usdcBalance =
        balanceResponse.data?.data?.tokenBalances?.find(
          (balance: any) => balance.token?.symbol === "USDC",
        )?.amount || "0";

      // Update wallet balance in database
      await supabase
        .from("wallets")
        .update({ balance: usdcBalance })
        .eq("circle_wallet_id", normalizedWalletId)
        .eq("blockchain", normalizedNetwork);

      return NextResponse.json({ balance: usdcBalance });
    } catch (error) {
      console.error("Error fetching balance from Circle API:", error);

      if (axios.isAxiosError(error)) {
        console.error("API error details:", {
          status: error.response?.status,
          data: error.response?.data,
        });

        // If the first blockchain fails, try the alternate blockchain
        // This handles wallets that might be on a different network than expected
        const alternateBlockchain = blockchain.includes("MATIC")
          ? "BASE-SEPOLIA" // Try Base if Polygon fails
          : "MATIC-AMOY"; // Try Polygon if Base fails

        try {
          const retryResponse = await axios.get(
            `https://api.circle.com/v1/w3s/buidl/wallets/${alternateBlockchain}/${walletAddress}/balances`,
            {
              headers: {
                "X-Request-Id": crypto.randomUUID(),
                Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              params: {
                name: "USDC",
              },
            },
          );

          // FIXED: Extract from data.tokenBalances instead of tokenBalances
          const retryBalance =
            retryResponse.data?.data?.tokenBalances?.find(
              (balance: any) => balance.token?.symbol === "USDC",
            )?.amount || "0";

          // Update wallet balance in database
          await supabase
            .from("wallets")
            .update({ balance: retryBalance })
            .eq("circle_wallet_id", normalizedWalletId)
            .eq("blockchain", normalizedNetwork);

          return NextResponse.json({ balance: retryBalance });
        } catch (retryError) {
          console.error("Error on retry attempt:", retryError);
          // Continue to return 0 if both attempts fail
        }
      }

      // Return 0 balance instead of error for better UX
      return NextResponse.json({ balance: "0" });
    }
  } catch (error) {
    console.error("Error in wallet balance endpoint:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 },
      );
    }

    // For any other errors, return 0 balance for better UX
    return NextResponse.json({ balance: "0" });
  }
}

/**
 * Converts a network name to Circle's blockchain parameter format
 */
function determineBlockchain(networkName: string): string {
  // Normalize the network name to lowercase for comparison
  const normalizedNetwork = networkName.toLowerCase();

  if (normalizedNetwork.includes("polygon")) {
    return "MATIC-AMOY"; // Polygon testnet
  }
  if (normalizedNetwork.includes("base")) {
    return "BASE-SEPOLIA"; // Base testnet
  }
  // Default to Polygon if no match found
  return "MATIC-AMOY";
}
