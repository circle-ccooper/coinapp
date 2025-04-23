"use client";

import { GlobalContextProvider } from "@/contexts/global-context";
import { createClient } from "@/lib/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>()

  const getUser = async () => {
    const {
      data: { user: loggedUser },
    } = await supabase.auth.getUser();

    if (loggedUser) {
      router.push('/dashboard')
      return
    }

    setUser(null)
  }

  useEffect(() => {
    getUser()
  }, [])

  if (user === undefined) return null;

  return (
    <GlobalContextProvider>
      <div className="flex flex-col flex-1 items-center px-5 pb-5 mt-[66px]">{children}</div>
    </GlobalContextProvider>
  );
}
