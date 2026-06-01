"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { PersistentNav } from "@/components/layout/persistent-nav";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <PersistentNav />
      <Toaster />
    </SessionProvider>
  );
}
