"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, PlusCircle, Users, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import type { Role } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
};

const navItems: NavItem[] = [
  { href: "/calendar", label: "Calendario", icon: Calendar, roles: ["ADMIN", "TEACHER", "CLIENT"] },
  { href: "/book", label: "Reservar", icon: PlusCircle, roles: ["CLIENT"] },
  { href: "/admin/teachers", label: "Profesores", icon: Users, roles: ["ADMIN"] },
  { href: "/teacher/schedule", label: "Mi horario", icon: BookOpen, roles: ["TEACHER"] },
  { href: "/my-bookings", label: "Mis reservas", icon: BookOpen, roles: ["CLIENT"] },
  { href: "/admin/dashboard", label: "Dashboard", icon: Users, roles: ["ADMIN"] },
  { href: "/settings", label: "Ajustes", icon: Settings, roles: ["ADMIN", "TEACHER", "CLIENT"] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!role) return null;

  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  const displayItems = visibleItems.slice(0, 5);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch h-16">
        {displayItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                isActive ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
