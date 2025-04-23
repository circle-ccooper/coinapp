"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { InfoIcon, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getExplorerUrl } from "@/lib/utils/get-explorer-url";

interface WalletInformationDialogProps {
  wallets: Array<{
    wallet_address: string;
    blockchain: string;
    chain: string;
  }>;
}

export function WalletInformationDialog({ wallets }: WalletInformationDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(wallets[0]?.chain || "polygon");

  // Chain display names
  const chainNames: Record<string, string> = {
    polygon: 'Polygon Amoy',
    base: 'Base Sepolia'
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast({
      title: "Address copied",
      description: "The wallet address has been copied to your clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <InfoIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet Information</DialogTitle>
          <DialogDescription>
            Your wallet details for different blockchains
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue={activeTab}
          onValueChange={setActiveTab}
          className="w-full mt-4"
        >
          <TabsList className="grid grid-cols-2 w-full">
            {wallets.map((wallet) => (
              <TabsTrigger key={wallet.chain} value={wallet.chain}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${wallet.chain === 'polygon' ? 'bg-purple-500' : 'bg-blue-500'
                      }`}
                  ></div>
                  {chainNames[wallet.chain] || wallet.blockchain}
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          {wallets.map((wallet) => (
            <TabsContent key={wallet.chain} value={wallet.chain} className="mt-4">
              <div className="flex flex-col space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Wallet Address</div>
                  <div className="flex items-center justify-between bg-muted p-3 rounded-md">
                    <code className="text-xs font-mono break-all">
                      {wallet.wallet_address}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyAddress(wallet.wallet_address)}
                      className="ml-2"
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-1">Blockchain</div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm">
                      {chainNames[wallet.chain] || wallet.blockchain}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full"
                  >
                    <a
                      href={getExplorerUrl(wallet.chain, wallet.wallet_address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on Block Explorer
                    </a>
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}