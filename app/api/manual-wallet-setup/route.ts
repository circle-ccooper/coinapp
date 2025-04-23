// app/api/manual-wallet-setup/route.ts
// This is for debugging/testing - creates wallets manually for existing users

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { email, polygon_address, base_address, passkey_credential } =
      await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get the profile by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found", details: profileError },
        { status: 404 }
      );
    }

    // Check if wallets exist
    const { data: existingWallets } = await supabase
      .from("wallets")
      .select("*")
      .eq("profile_id", profile.id);

    // If wallets exist, update them
    if (existingWallets && existingWallets.length > 0) {
      // Update Polygon wallet
      const polygonWallet = existingWallets.find(
        (w) => w.blockchain === "POLYGON"
      );
      if (polygonWallet) {
        await supabase
          .from("wallets")
          .update({
            wallet_address:
              polygon_address || "0x1234567890123456789012345678901234567890",
            passkey_credential: passkey_credential || null,
            circle_wallet_id:
              polygon_address || "0x1234567890123456789012345678901234567890",
          })
          .eq("id", polygonWallet.id);
      }

      // Update Base wallet
      const baseWallet = existingWallets.find(
        (w) => w.blockchain === "BASE"
      );
      if (baseWallet) {
        await supabase
          .from("wallets")
          .update({
            wallet_address:
              base_address || "0x1234567890123456789012345678901234567890",
            passkey_credential: passkey_credential || null,
            circle_wallet_id:
              base_address || "0x1234567890123456789012345678901234567890",
          })
          .eq("id", baseWallet.id);
      }
    } else {
      // Create Polygon wallet
      await supabase.from("wallets").insert({
        profile_id: profile.id,
        wallet_address:
          polygon_address || "0x1234567890123456789012345678901234567890",
        wallet_type: "modular",
        blockchain: "POLYGON",
        account_type: "SCA",
        currency: "MATIC",
        passkey_credential: passkey_credential || null,
        circle_wallet_id:
          polygon_address || "0x1234567890123456789012345678901234567890",
      });

      // Create Base wallet
      await supabase.from("wallets").insert({
        profile_id: profile.id,
        wallet_address:
          base_address || "0x1234567890123456789012345678901234567890",
        wallet_type: "modular",
        blockchain: "BASE",
        account_type: "SCA",
        currency: "ETH",
        passkey_credential: passkey_credential || null,
        circle_wallet_id:
          base_address || "0x1234567890123456789012345678901234567890",
      });
    }

    return NextResponse.json(
      { success: true, message: "Wallets created/updated for user" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in manual wallet setup:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to set up wallets: ${message}` },
      { status: 500 }
    );
  }
}
