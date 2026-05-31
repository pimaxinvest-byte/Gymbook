"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, Activity, FileText, Loader2, Trash2 } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { toast } from "@/components/ui/toaster";

interface BookingDetail {
  id: string;
  startDatetime: string;
  endDatetime: string;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED" | "COMPLETED" | "BLOCKED";
  notes?: string;
  color?: string;
  teacher: { user: { name: string }; color: string };
  client?: { user: { name: string } };
  space: { name: string };
  activity: { name: string };
}

interface BookingDetailModalProps {
  bookingId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function BookingDetailModal({ bookingId, onClose, onUpdate }: BookingDetailModalProps) {
  const { data: session } = useSession();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking)
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handleCancel() {
    setCancelling(true);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) {
      toast({ title: "Reserva cancelada", variant: "success" });
      onUpdate();
    } else {
      toast({ title: "Error al cancelar", variant: "error" });
      setCancelling(false);
    }
  }

  const canCancel =
    booking &&
    ["AVAILABLE", "BOOKED"].includes(booking.status) &&
    (session?.user?.role === "ADMIN" ||
      session?.user?.role === "TEACHER" ||
      (session?.user?.role === "CLIENT" && booking.status === "BOOKED"));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle>Detalle de reserva</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : booking ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <StatusBadge status={booking.status} />
              <div
                className="w-4 h-4 rounded-full ring-2 ring-white shadow"
                style={{ backgroundColor: booking.teacher.color }}
              />
            </div>

            {/* Details */}
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <DetailRow icon={Activity} label="Actividad" value={booking.activity.name} />
              <DetailRow icon={User} label="Profesor" value={booking.teacher.user.name} />
              {booking.client && (
                <DetailRow icon={User} label="Cliente" value={booking.client.user.name} />
              )}
              <DetailRow icon={MapPin} label="Espacio" value={booking.space.name} />
              <DetailRow
                icon={Calendar}
                label="Día"
                value={formatDate(new Date(booking.startDatetime))}
              />
              <DetailRow
                icon={Clock}
                label="Horario"
                value={`${formatTime(new Date(booking.startDatetime))} – ${formatTime(new Date(booking.endDatetime))}`}
              />
              {booking.notes && (
                <DetailRow icon={FileText} label="Notas" value={booking.notes} />
              )}
            </div>

            {/* Actions */}
            {canCancel && (
              <Button
                variant="destructive"
                size="lg"
                className="w-full"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Cancelar reserva
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Reserva no encontrada</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
