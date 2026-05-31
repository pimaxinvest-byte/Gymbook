"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import Image from "next/image";
import { useEffect, useState } from "react";

interface HeaderProps {
  title?: string;
  gymName?: string;
  logoUrl?: string;
}

interface UserProfile {
  avatarUrl?: string | null;
  telegramChatId?: string | null;
}

export function Header({ title, gymName = "GymBook", logoUrl }: HeaderProps) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile>({});

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/profile`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setProfile(d); })
      .catch(() => {});
  }, [session?.user?.id]);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo + gym name */}
        <div className="flex items-center gap-2.5">
          <Image
            src={logoUrl || "/logo.svg"}
            alt={`Logo de ${gymName}`}
            width={36}
            height={36}
            className="rounded-xl object-contain"
            priority
          />
          <div>
            <p className="text-xs text-gray-500 leading-none">{gymName}</p>
            {title && <h1 className="text-sm font-bold text-gray-900 leading-tight">{title}</h1>}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* User avatar with telegram LED */}
          {session && (
            <Avatar
              name={session.user.name || ""}
              avatarUrl={profile.avatarUrl}
              telegramChatId={profile.telegramChatId}
              size="sm"
            />
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificaciones"
            className="relative text-gray-500 hover:text-gray-700"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>

          {session && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-gray-500 hover:text-red-500"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
