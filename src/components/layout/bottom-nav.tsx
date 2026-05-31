"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, PlusCircle, Users, BookOpen, Settings, LayoutDashboard, CreditCard, CalendarCheck, UserCircle } from "lucide-react";
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
  { href: "/calendar",             label: "Calendario",  icon: Calendar,       roles: ["ADMIN", "TEACHER", "CLIENT"] },
  { href: "/book",                 label: "Reservar",    icon: PlusCircle,     roles: ["CLIENT"] },
  { href: "/my-bookings",          label: "Mis clases",  icon: BookOpen,       roles: ["CLIENT"] },
  { href: "/credits",              label: "Créditos",    icon: CreditCard,     roles: ["CLIENT"] },
  { href: "/teacher/schedule",     label: "Planning",    icon: CalendarCheck,  roles: ["TEACHER"] },
  { href: "/teacher/availability", label: "Disponib.",   icon: PlusCircle,     roles: ["TEACHER"] },
  { href: "/teacher/clients",      label: "Clientes",    icon: UserCircle,     roles: ["TEACHER"] },
  { href: "/credits",              label: "Créditos",    icon: CreditCard,     roles: ["TEACHER"] },
  { href: "/admin/dashboard",      label: "Dashboard",   icon: LayoutDashboard,roles: ["ADMIN"] },
  { href: "/admin/teachers",       label: "Equipo",      icon: Users,          roles: ["ADMIN"] },
  { href: "/credits",              label: "Créditos",    icon: CreditCard,     roles: ["ADMIN"] },
  { href: "/settings",             label: "Ajustes",     icon: Settings,       roles: ["ADMIN", "TEACHER", "CLIENT"] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!role) return null;

  const visibleItems = navItems
    .filter((item) => item.roles.includes(role))
    .slice(0, 5); // max 5 tabs

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${role}`}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-200",
                "min-h-[44px]",
                isActive ? "text-orange-500" : "text-gray-400 hover:text-gray-600"
              )}
            >
              {/* Active top indicator */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full"
                />
              )}

              <Icon
                className={cn("h-5 w-5 transition-all duration-200", isActive && "scale-110")}
                strokeWidth={isActive ? 2.5 : 2}
                aria-hidden="true"
              />
              <span className="leading-none text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
