import { cn } from "@/lib/utils";
import type { BookingStatus } from "@prisma/client";

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  AVAILABLE: { label: "Disponible", className: "bg-emerald-100 text-emerald-700" },
  BOOKED: { label: "Reservado", className: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "Cancelado", className: "bg-red-100 text-red-700" },
  COMPLETED: { label: "Completado", className: "bg-gray-100 text-gray-600" },
  BLOCKED: { label: "Bloqueado", className: "bg-orange-100 text-orange-700" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700", className)}>
      {children}
    </span>
  );
}
