"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useWeb3 } from "@/components/web3-provider";
import { useBalance } from "@/contexts/balanceContext";
import { useEffect } from "react";

interface Props {
  open: boolean;
  transactionHash: string;
  onOpenChange: (value: boolean) => void;
}

export default function TransactionResultDialog({
  open,
  transactionHash,
  onOpenChange,
}: Props) {
  const { activeChain } = useWeb3();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment sent</DialogTitle>
          <DialogDescription>Your transaction details</DialogDescription>
        </DialogHeader>

        <Link
          href={
            activeChain === 'base'
              ? `https://sepolia.basescan.org/tx/${transactionHash}`
              : `https://amoy.polygonscan.com/tx/${transactionHash}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2"
        >
          <Button variant="outline" size="sm" className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            View on Block Explorer
          </Button>
        </Link>
      </DialogContent>
    </Dialog>
  );
}
