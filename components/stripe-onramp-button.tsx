"use client";

import { type FunctionComponent, type HTMLProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props extends HTMLProps<HTMLElement> {
  chain: 'polygon' | 'base'
}

export const StripeOnrampButton: FunctionComponent<Props> = ({ className, chain }) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false);

  const redirectToRamp = async () => {
    setLoading(true);

    const response = await fetch('/api/stripe/onramp', {
      method: 'POST',
      body: JSON.stringify({
        chain
      })
    })
    const stripeOnrampData = await response.json()

    setLoading(false);
    router.push(stripeOnrampData.url)
  }

  return (
    <Button className={className} disabled={loading} onClick={redirectToRamp}>
      {loading
        ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        )
        : "Add USDC"}
    </Button>
  )
}