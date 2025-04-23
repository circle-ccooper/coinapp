import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { CryptoElements, OnrampElement } from "@/components/stripe-crypto-elements";
  import { useCallback, useEffect, useState } from "react";
  import { loadStripeOnramp } from "@stripe/crypto";
  import { useWeb3 } from "./web3-provider";
  import { DialogTrigger } from "@radix-ui/react-dialog";
  import { Button } from "@/components/ui/button";
  import { useTheme } from "next-themes";
  import { toast } from "sonner";

  interface Props {
    open: boolean
    onOpenChange: (value: boolean) => void
  }

  // Make sure to call loadStripeOnramp outside of a component’s render to avoid
  // recreating the StripeOnramp object on every render.
  // This is your test publishable API key.
  const stripeOnrampPromise = loadStripeOnramp(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  export default function StripeOnrampDialog({ open, onOpenChange }: Props) {
    const { activeChain } = useWeb3()
    const [clientSecret, setClientSecret] = useState("");
    const { theme } = useTheme()

    useEffect(() => {
      // Fetches an onramp session and captures the client secret
      fetch(
        "/api/stripe/onramp",
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chain: activeChain
        })
      })
        .then((res) => res.json())
        .then((data) => setClientSecret(data.clientSecret));
    }, [activeChain]);

    const onChange = useCallback<(payload: any) => void>(({ session }) => {
      if (session.status !== "fulfillment_complete") return

      toast.success("Funds added successfully")
      onOpenChange(false)
    }, []);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button className="flex-1 py-3 text-lg font-semibold rounded-full">
            Add USDC
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle></DialogTitle>
          </DialogHeader>
          <CryptoElements stripeOnramp={stripeOnrampPromise}>
            {clientSecret && (
              <OnrampElement
                id="onramp-element"
                clientSecret={clientSecret}
                appearance={{ theme }}
                onChange={onChange}
              />
            )}
          </CryptoElements>
        </DialogContent>
      </Dialog>
    )
  }