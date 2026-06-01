"use client";

import { useSession } from "next-auth/react";
import { BottomNav } from "./bottom-nav";

/**
 * Wrapper that renders BottomNav in the root layout.
 * Persists across page navigations — no flicker.
 * Hidden on login/register routes.
 */
export function PersistentNav() {
  const { data: session, status } = useSession();

  // Don't render while loading or when unauthenticated
  if (status === "loading" || !session?.user?.role) {
    // Return a fixed-height placeholder so content doesn't jump
    return null;
  }

  return <BottomNav />;
}
