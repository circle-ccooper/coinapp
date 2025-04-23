import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { polygonAmoy, baseSepolia } from "viem/chains";

// Schema for validating request parameters
const WalletIdSchema = z.object({
  walletId: z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
    message: "Invalid Ethereum wallet address format",
  }),
  networkId: z.number().optional().default(polygonAmoy.id),
  pageSize: z.number().optional().default(50), // Maximum size for Circle API
  pageAfter: z.string().optional(),
  pageBefore: z.string().optional(),
  from: z.string().optional(), // ISO date format
  to: z.string().optional(), // ISO date format
});

// Map our network IDs to Circle's blockchain names
const NETWORK_TO_BLOCKCHAIN: { [key: number]: string } = {
  [polygonAmoy.id]: "MATIC-AMOY",
  [baseSepolia.id]: "BASE-SEPOLIA",
};

// Network names for display
const NETWORK_NAMES: { [key: number]: string } = {
  [polygonAmoy.id]: "Polygon Amoy",
  [baseSepolia.id]: "Base Sepolia",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = WalletIdSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request parameters",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { walletId, networkId, pageSize, pageAfter, pageBefore, from, to } =
      parseResult.data;

    // Make sure we support the requested network
    if (!NETWORK_TO_BLOCKCHAIN[networkId]) {
      return NextResponse.json(
        { error: `Unsupported network ID: ${networkId}` },
        { status: 400 }
      );
    }

    // Build the Circle API URL with query parameters
    const blockchain = NETWORK_TO_BLOCKCHAIN[networkId];
    const baseUrl = "https://api.circle.com/v1/w3s/buidl/transfers";

    const params = new URLSearchParams();
    params.append("walletAddresses", walletId);
    params.append("blockchain", blockchain);
    params.append("pageSize", pageSize.toString());

    if (pageAfter) params.append("pageAfter", pageAfter);
    if (pageBefore) params.append("pageBefore", pageBefore);
    if (from) params.append("from", from);
    if (to) params.append("to", to);

    const url = `${baseUrl}?${params.toString()}`;

    // Call the Circle API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Circle API error:", errorData);

      return NextResponse.json(
        { error: `Failed to fetch transfers: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Parse the Circle API response
    const circleData = await response.json();

    // Transform the Circle API response to match our expected format
    // Define the Circle API response types
    interface CircleTransfer {
      txHash: string;
      fromAddress?: string;
      from?: string;
      toAddress?: string;
      to?: string;
      amount: string;
      createDate: string;
      state: string;
      tokenId: string;
      transferType: string;
      userOpHash: string;
      updateDate: string;
      id: string;
    }

    interface CircleResponse {
      data: {
        transfers: CircleTransfer[];
        hasMore: boolean;
        pageAfter?: string;
        pageBefore?: string;
      };
    }

    // Define our transformed transaction type
    interface Transaction {
      hash: string;
      from?: string;
      to?: string;
      amount: string;
      timestamp: string;
      networkId: number;
      networkName: string;
      state: string;
      transactionType: 'sent' | 'received';
      tokenId: string;
      transferType: string;
      userOpHash: string;
      updateDate: string;
      id: string;
    }

    const transactions: Transaction[] = (circleData as CircleResponse).data.transfers.map((transfer: CircleTransfer) => {
      // Determine transaction type and direction
      const fromAddress = transfer.fromAddress || transfer.from;
      const toAddress = transfer.toAddress || transfer.to;
      const isSent =
        fromAddress && fromAddress.toLowerCase() === walletId.toLowerCase();
      const transactionType = isSent ? "sent" : "received";

      return {
        hash: transfer.txHash,
        from: transfer.fromAddress,
        to: transfer.toAddress,
        amount: transfer.amount,
        timestamp: transfer.createDate,
        networkId: networkId,
        networkName: NETWORK_NAMES[networkId],
        state: transfer.state,
        transactionType: transactionType,
        tokenId: transfer.tokenId,
        transferType: transfer.transferType,
        userOpHash: transfer.userOpHash,
        updateDate: transfer.updateDate,
        id: transfer.id,
      };
    });

    // Include pagination data from Circle's response
    return NextResponse.json({
      transactions,
      pagination: {
        hasMore: circleData.data.hasMore,
        pageAfter: circleData.data.pageAfter,
        pageBefore: circleData.data.pageBefore,
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);

    return NextResponse.json(
      {
        error:
          "Internal server error: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
