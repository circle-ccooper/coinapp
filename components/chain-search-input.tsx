"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { useWeb3 } from "@/components/web3-provider";
import { useBalance } from "@/contexts/balanceContext";

const chains = [
  {
    value: "polygon",
    label: "Polygon",
  },
  {
    value: "base",
    label: "Base",
  },
]

export default function ChainSearchInput() {
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false)
  const { activeChain, setActiveChain } = useWeb3();
  const { balances } = useBalance()

  return (
    <div className="flex items-center relative gap-x-3">
      <Label className="text-base font-semibold" htmlFor="recipient">
        Use
      </Label>
      <Popover open={chainDropdownOpen} onOpenChange={setChainDropdownOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={chainDropdownOpen}
            className="justify-start flex-1"
          >
            <img className="mr-2" width="24" src={`/${activeChain}-logo.svg`} />
            {activeChain
              ? chains.find((chain) => chain.value === activeChain)?.label
              : "Select chain..."}
            {' '}
            {activeChain && `(Balance: $${balances[activeChain].token})`}
            <ChevronsUpDown className="opacity-50 ml-auto" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <Command>
            <CommandInput placeholder="Search chain..." />
            <CommandList>
              <CommandEmpty>No chain found.</CommandEmpty>
              <CommandGroup>
                {chains.map((chain) => (
                  <CommandItem
                    key={chain.value}
                    value={chain.value}
                    onSelect={(currentValue) => {
                      setActiveChain(currentValue as 'polygon' | 'base')
                      setChainDropdownOpen(false)
                    }}
                  >
                    <img width="24" src={`/${chain.value}-logo.svg`} />
                    {chain.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        activeChain === chain.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}