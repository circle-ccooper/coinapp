import type { Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Web3Provider } from "@/components/web3-provider";
import { BalanceProvider } from "@/contexts/balanceContext";

const defaultUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "CoinApp",
  description: "Seamless, Gasless Transactions with Passkey Security and Instant Top-ups",
};

export const viewport: Viewport = {
  interactiveWidget: 'resizes-content'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background/5 text-foreground flex items-center justify-center min-h-svh">
        <Web3Provider>
          <BalanceProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <Toaster expand />
              {/* Phone simulation container */}
              <div className="w-full max-w-[430px] h-screen max-h-[932px] flex flex-col bg-background shadow-xl overflow-hidden">
                <main className="flex-1 flex flex-col items-center overflow-auto">
                  <div className="flex flex-col w-full flex-1 pt-2">
                    {children}
                  </div>
                </main>
              </div>
            </ThemeProvider>
          </BalanceProvider>
        </Web3Provider>
      </body>
    </html>
  );
}