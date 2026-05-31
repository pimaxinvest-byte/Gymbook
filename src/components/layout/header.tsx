"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface HeaderProps {
  title?: string;
  gymName?: string;
  logoUrl?: string;
}

export function Header({ title, gymName = "GymBook", logoUrl }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <Image src={logoUrl} alt={gymName} width={28} height={28} className="rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">G</span>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 leading-none">{gymName}</p>
            {title && <h1 className="text-sm font-bold text-gray-900 leading-tight">{title}</h1>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
          </Button>
          {session && (
            <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
