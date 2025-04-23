import { NextResponse } from "next/server";
import { createClient } from "@/lib/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get the current session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return NextResponse.json({
      authenticated: !!user,
      user,
    });
  } catch (error) {
    console.error("Error checking auth status:", error);
    return NextResponse.json({
      authenticated: false,
      error: "Failed to check authentication status",
    });
  }
}
