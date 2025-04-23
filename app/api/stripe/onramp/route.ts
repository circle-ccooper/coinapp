import { createClient } from "@/lib/utils/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const OnrampSessionResource = Stripe.StripeResource.extend({
  create: Stripe.StripeResource.method({
    method: "POST",
    path: "crypto/onramp_sessions",
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    const chain = body.chain?.toUpperCase();

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select()
      .match({
        profile_id: profile.id,
        blockchain: chain || "POLYGON",
      })
      .single();

    if (walletError) {
      console.error("Error fetching wallet:", walletError);
      return NextResponse.json(
        { error: walletError?.message ?? "Wallet not found" },
        { status: 404 },
      );
    }
    // Create an OnrampSession with the order amount and currency
    // Even though TypeScript doesn't recognizes this as a Promise, it needs an "await" keyword
    const onrampSession = (await new OnrampSessionResource(stripe).create({
      transaction_details: {
        wallet_address: wallet.wallet_address,
        destination_currency: "usdc",
        destination_exchange_amount: "10",
        supported_destination_networks: ["base", "polygon"],
        destination_network: body.chain,
      },
    })) as Stripe.Response<{ client_secret: string }>;

    return NextResponse.json({ clientSecret: onrampSession.client_secret });
  } catch (error) {
    console.error("Error requesting Stripe onramp url:", error);

    return NextResponse.json(
      { error: "Internal server error while requesting Stripe onramp url" },
      { status: 500 },
    );
  }
}
