import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { credential, circleAddress } = await req.json();

    if (!credential) {
      return NextResponse.json(
        { error: "Credential is required" },
        { status: 400 }
      );
    }

    // Get user session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select()
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profileData) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Parse the credential
    const parsedCredential = JSON.parse(credential);

    // Determine which address to use
    let walletAddress;

    // If the client provided a Circle-generated address, use it
    if (circleAddress) {
      walletAddress = circleAddress;
    } else {
      // Fallback to original address derivation logic
      const publicKey = parsedCredential.publicKey;

      // Validate the public key format
      const isValidPublicKey =
        publicKey &&
        publicKey.startsWith("0x") &&
        /^0x[0-9a-fA-F]{40,}$/.test(publicKey);

      if (!isValidPublicKey) {
        throw new Error(`Invalid public key format: ${publicKey}`);
      }

      // Use the first 42 characters of the public key (0x + 40 hex chars)
      walletAddress = publicKey.slice(0, 42).toLowerCase();
    }

    // Check if wallet records exist for this profile
    const { data: existingWallets } = await supabase
      .from("wallets")
      .select()
      .eq("profile_id", profileData.id);

    // Store the credential string for database storage
    const credentialString =
      typeof credential === "string" ? credential : JSON.stringify(credential);

    if (existingWallets && existingWallets.length > 0) {

      // Update existing Polygon wallet
      const polygonWallet = existingWallets.find(
        (w) => w.blockchain === "POLYGON"
      );
      if (polygonWallet) {
        const { error: polygonUpdateError } = await supabase
          .from("wallets")
          .update({
            wallet_address: walletAddress,
            passkey_credential: credentialString,
            circle_wallet_id: walletAddress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", polygonWallet.id);

        if (polygonUpdateError) {
          console.error("Error updating Polygon wallet:", polygonUpdateError);
        }
      }

      // Update existing Base wallet
      const baseWallet = existingWallets.find(
        (w) => w.blockchain === "BASE"
      );
      if (baseWallet) {
        const { error: baseUpdateError } = await supabase
          .from("wallets")
          .update({
            wallet_address: walletAddress,
            passkey_credential: credentialString,
            circle_wallet_id: walletAddress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", baseWallet.id);

        if (baseUpdateError) {
          console.error("Error updating Base wallet:", baseUpdateError);
        }
      }
    } else {
      // Create new wallet records
      const { error: insertError } = await supabase.from("wallets").insert([
        {
          profile_id: profileData.id,
          wallet_address: walletAddress,
          wallet_type: "modular",
          blockchain: "POLYGON",
          account_type: "SCA",
          currency: "USDC",
          passkey_credential: credentialString,
          circle_wallet_id: walletAddress,
        },
        {
          profile_id: profileData.id,
          wallet_address: walletAddress,
          wallet_type: "modular",
          blockchain: "BASE",
          account_type: "SCA",
          currency: "USDC",
          passkey_credential: credentialString,
          circle_wallet_id: walletAddress,
        },
      ]);

      if (insertError) {
        console.error("Error inserting new wallets:", insertError);
        return NextResponse.json(
          { error: "Could not create wallets" },
          { status: 500 }
        );
      }
    }

    // Update user metadata to mark wallet setup as complete
    const { error: updateUserError } = await supabase.auth.updateUser({
      data: {
        wallet_setup_complete: true,
        wallet_address: walletAddress, // Store the wallet address in user metadata
      },
    });

    if (updateUserError) {
      console.error("Error updating user metadata:", updateUserError);
    }

    // Set a cookie to indicate successful wallet setup - retained for backward compatibility
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `wallet_setup_complete=true; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
    );

    // Return the response with the headers
    return new NextResponse(
      JSON.stringify({
        message: "Wallets created successfully",
        polygonAddress: walletAddress,
        baseAddress: walletAddress,
        success: true,
        redirectUrl: "/dashboard",
      }),
      {
        status: 201,
        headers,
      }
    );
  } catch (error) {
    console.error("Error setting up wallets:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to set up wallets: ${message}` },
      { status: 500 }
    );
  }
}
