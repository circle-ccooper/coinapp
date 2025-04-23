import type { Wallet } from "@/types/database.types";
import { Transactions } from "@/components/transactions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions";

interface Props {
  primaryWallet: Wallet
  profile: {
    id: any;
  } | null;
}

export default async function TransactionsTab({ primaryWallet, profile }: Props) {
  return (
    <>
      <form className="flex items-center justify-between w-full pb-4" action={signOutAction}>
        <p className="text-2xl font-semibold">
          Activity
        </p>
        <Button variant="ghost" size="icon">
          <LogOut />
        </Button>
      </form>
      <Transactions wallet={primaryWallet} profile={profile} />
    </>
  )
}