
import { NextResponse } from "next/server";
import { createClient } from "@/lib/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get user data
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*");

    if (profilesError) {
      return NextResponse.json(
        { error: "Error fetching profiles", details: profilesError },
        { status: 500 }
      );
    }

    // Get all wallets
    const { data: wallets, error: walletsError } = await supabase
      .from("wallets")
      .select("*");

    if (walletsError) {
      return NextResponse.json(
        { error: "Error fetching wallets", details: walletsError },
        { status: 500 }
      );
    }

    // Check if tables have the expected columns
    const { data: walletsColumns, error: walletsColumnsError } =
      await supabase.rpc("get_table_columns", { table_name: "wallets" });

    if (walletsColumnsError) {
      return NextResponse.json(
        { error: "Error checking table columns", details: walletsColumnsError },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        currentUser: user,
        profilesCount: profiles.length,
        profiles: profiles,
        walletsCount: wallets.length,
        wallets: wallets,
        walletsColumns: walletsColumns,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Debug error: ${message}` },
      { status: 500 }
    );
  }
}
