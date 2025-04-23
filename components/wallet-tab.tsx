"use client";

import { Button } from "@/components/ui/button";
import { LogOut, RotateCw } from "lucide-react";
import { signOutAction } from "@/app/actions";
import VirtualKeyboard from "@/components/virtual-keyboard";
import { useState } from "react";
import { calculateFontSize } from "@/lib/utils/calculate-font-size";
import { RecipientSearchInput } from "@/components/recipient-search.input";
import ChainSearchInput from "@/components/chain-search-input";
import { useWeb3 } from "@/components/web3-provider";
import { useToast } from "@/hooks/use-toast";
import TransactionResultDialog from "@/components/transaction-result-dialog";
import AddressValidationDialog from "./ui/address-validation-dialog";

export default function WalletTab() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [transactionSent, setTransactionSent] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [showAddressValidation, setShowAddressValidation] = useState(false);

  const { accounts, activeChain, isConnected, sendUSDC } = useWeb3();

  const { toast } = useToast();

  // Get current chain address
  const currentAddress = accounts[activeChain]?.address || null;

  const handlePayButtonClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !currentAddress) {
      toast({
        title: "Not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    // Validate amount
    if (amount === "0" || amount === "" || amount.endsWith(".")) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Show address validation dialog
    setShowAddressValidation(true);
  };

  const handleSend = async () => {
    setShowAddressValidation(false);
    setIsLoading(true);

    try {
      const txHash = await sendUSDC(recipient, amount);
      if (txHash) {
        toast({
          title: "Transaction sent!",
          description: `Transaction hash: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`,
          variant: "default",
        });

        // Reset form
        setRecipient("");
        setAmount("0");
        setTransactionSent(true);
        setTransactionHash(txHash);
      } else {
        throw new Error("Transaction failed - no hash returned");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Transaction failed",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelTransaction = () => {
    setShowAddressValidation(false);
  };

  return (
    <>
      <TransactionResultDialog
        transactionHash={transactionHash}
        open={transactionSent}
        onOpenChange={setTransactionSent}
      />
      <AddressValidationDialog
        open={showAddressValidation}
        onOpenChange={setShowAddressValidation}
        address={recipient}
        onConfirm={handleSend}
        onCancel={cancelTransaction}
        chainId={activeChain}
      />
      <form
        className="flex items-center justify-between w-full pb-4"
        action={signOutAction}
      >
        <Button className="ml-auto" variant="ghost" size="icon">
          <LogOut />
        </Button>
      </form>
      <div className="flex flex-col flex-1 justify-between h-full min-h-0">
        <div className="flex flex-col gap-y-4">
          <RecipientSearchInput
            value={recipient}
            onChange={setRecipient}
            required
          />
          <ChainSearchInput />
        </div>
        <p
          className="flex items-center justify-center font-bold"
          style={{ fontSize: calculateFontSize(amount) }}
        >
          ${amount}
        </p>
        <VirtualKeyboard value={amount} onChangeText={setAmount} />
      </div>
      <Button
        disabled={
          amount === "0" || amount.endsWith(".") || isLoading || !recipient
        }
        className="py-7 text-lg font-semibold rounded-full w-full my-4"
        onClick={handlePayButtonClick}
      >
        {isLoading ? (
          <>
            <RotateCw className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Pay"
        )}
      </Button>
    </>
  );
}
