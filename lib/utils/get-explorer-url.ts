// Explorer URLs for different chains
export const getExplorerUrl = (chain: string, address: string) => {
  const explorers: Record<string, string> = {
    polygon: `https://www.oklink.com/amoy/address/${address}`,
    base: `https://sepolia.basescan.org/address/${address}`
  };

  return explorers[chain] || '#';
};