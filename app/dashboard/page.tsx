import { redirect } from "next/navigation";
import { TabsContent } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server-client";

const BalanceTab = dynamic(() => import("@/components/balance-tab"), { ssr: true });
const WalletTab = dynamic(() => import("@/components/wallet-tab"), { ssr: true });
const TransactionsTab = dynamic(() => import("@/components/transactions-tab"), { ssr: true });

export default async function Dashboard() {
  const supabase = await createSupabaseServerComponentClient();

  // Use getUser() instead of getSession() for security
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Check if wallet setup is complete from user metadata
  const isWalletSetupComplete = user?.user_metadata?.wallet_setup_complete;

  const { data: profile } = await supabase
    .from("profiles")
    .select()
    .eq("auth_user_id", user?.id)
    .single();

  if (!profile) {
    return redirect("/sign-in");
  }

  // Check for wallets in database
  const { data: wallets } = await supabase
    .schema("public")
    .from("wallets")
    .select()
    .eq("profile_id", profile.id);

  // Redirect to setup if:
  // 1. No wallets AND wallet setup is not complete, OR
  // 2. Wallets exist but have placeholders (pending-setup) and setup is not complete
  const hasPendingWallets = wallets?.some(wallet =>
    wallet.circle_wallet_id === "pending-setup" || !wallet.wallet_address
  );

  if ((!wallets || wallets.length === 0 || hasPendingWallets) && !isWalletSetupComplete) {
    return redirect(`/dashboard/setup-wallet?username=${crypto.randomUUID()}`);
  }

  // Get all available wallets by blockchain
  const chainWallets = {
    polygon: wallets?.find(w => w.blockchain === "POLYGON"),
    base: wallets?.find(w => w.blockchain === "BASE")
  };

  // Create wallet models for UI
  const walletModels = Object.entries(chainWallets).map(([chain, wallet]) => {
    if (!wallet) {
      // Create fallback wallet data if not in database
      return {
        blockchain: chain.toUpperCase(),
        circle_wallet_id: "incomplete-setup",
        wallet_address: user?.user_metadata?.[`${chain}_address`] || "0x0",
        profile_id: profile.id,
        chain: chain,
      };
    }

    return {
      ...wallet,
      chain: chain.toLowerCase()
    };
  }).filter(wallet => wallet.wallet_address !== "0x0");

  // Default to the first available wallet
  const primaryWallet = walletModels[0] || {
    circle_wallet_id: "incomplete-setup",
    wallet_address: "0x0",
    profile_id: profile.id,
    chain: "polygon"
  };

  return (
    <>
      <TabsContent value="balance">
        <BalanceTab walletModels={walletModels} />
      </TabsContent>
      <TabsContent value="wallet">
        <WalletTab />
      </TabsContent>
      <TabsContent value="transactions">
        <TransactionsTab primaryWallet={primaryWallet} profile={profile} />
      </TabsContent>
    </>
  );
}
