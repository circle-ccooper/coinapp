import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletInformationDialog } from "@/components/wallet-information-dialog";
import { WalletBalance } from "@/components/wallet-balance";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions";

interface Props {
  walletModels: Array<{  
    wallet_address: string;
    blockchain: string;
    chain: string;
  }>;
}

export default async function BalanceTab({ walletModels }: Props) {
  return (
    <>
      <form className="flex items-center justify-between w-full pb-4" action={signOutAction}>
        <p className="text-2xl font-semibold">CoinApp</p>
        <Button variant="ghost" size="icon">
          <LogOut />
        </Button>
      </form>
      <div className="flex flex-wrap mb-4">
        {/* Wallet Card */}
        <Card className="w-full break-inside-avoid">
          <CardHeader className="flex-row items-center">
            <CardTitle className="mr-auto">USDC balance</CardTitle>
            <WalletInformationDialog
              wallets={walletModels}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <WalletBalance />
          </CardContent>
        </Card>
      </div>
    </>
  )
}