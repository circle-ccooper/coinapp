'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PasskeySetup } from '@/components/passkey-setup';
import { createClient } from '@/lib/utils/supabase/client';
import { useEffect, useState } from 'react';

export default function SetupWalletPage() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const username = searchParams.get('username') || '';
  const [walletSetupComplete, setWalletSetupComplete] = useState<boolean>()

  const getUser = async () => {
    const {
      data: { user: loggedUser },
    } = await supabase.auth.getUser();

    if (loggedUser?.user_metadata.wallet_setup_complete) {
      router.push('/dashboard')
      return
    }

    setWalletSetupComplete(false)
  }

  useEffect(() => {
    getUser()
  }, [router])

  if (walletSetupComplete === undefined) return null

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full p-6 bg-card border border-border rounded-lg shadow-sm">
        <PasskeySetup username={username} />
      </div>
    </div>
  );
}