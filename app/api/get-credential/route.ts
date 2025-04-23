import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET(req: NextRequest) {
  try {
    // Get the Supabase client
    const supabase = await createSupabaseServerClient();

    // Get user session from Supabase
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - No valid session" },
        { status: 401 },
      );
    }

    // Get the user's auth ID from the session
    const authUserId = user.id;

    if (!authUserId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 400 },
      );
    }

    // First, get the profile associated with the auth user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Profile not found for user" },
        { status: 404 },
      );
    }

    const profileId = profile.id;

    // Now fetch the wallet with the passkey credential using the profile_id
    const { data: passkeyCredential, error: walletError } = await supabase
      .from("wallets")
      .select("passkey_credential")
      .eq("profile_id", profileId)
      .limit(1);

    if (walletError || !passkeyCredential) {
      console.error("Error fetching wallet:", walletError);
      return NextResponse.json(
        { error: "Wallet not found in database" },
        { status: 404 },
      );
    }

    // Get the passkey credential
    const credential = passkeyCredential;

    if (!credential) {
      return NextResponse.json(
        { error: "Passkey credential not found for user" },
        { status: 404 },
      );
    }

    // Return the credential
    return NextResponse.json({ credential });
  } catch (error) {
    console.error("Error in get-credential endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
