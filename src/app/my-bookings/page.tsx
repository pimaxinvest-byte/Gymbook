"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { User, MapPin, Clock, CalendarPlus, Download, X, BookOpen } from "lucide-react";
import { BookingCardSkeleton } from "@/components/ui/skeleton";
import { googleCalendarUrl, downloadICS, type ExportBooking } from "@/lib/calendar-export";
import { toast } from "@/components/ui/toaster";

interface Booking {
  id: string;
  startDatetime: string;
  endDatetime: string;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED" | "COMPLETED" | "BLOCKED";
  sessionType?: string;
  teacher: { color: string; user: { name: string } };
  activity: { name: string };
  space: { name: string };
  notes?: string;
}

function toExport(b: Booking): ExportBooking {
  return {
    id: b.id,
    startDatetime: b.startDatetime,
    endDatetime: b.endDatetime,
    activityName: b.activity.name,
    teacherName: b.teacher.user.name,
    spaceName: b.space.name,
    notes: b.notes,
    sessionType: b.sessionType,
  };
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/bookings");
    const data = await r.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.startDatetime) >= now && b.status === "BOOKED");
  const history = bookings.filter((b) => new Date(b.startDatetime) < now || b.status !== "BOOKED");
  const displayed = tab === "upcoming" ? upcoming : history;

  async function handleCancel(bookingId: string) {
    if (!confirm("¿Cancelar esta reserva?")) return;
    setCancelling(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) {
      toast({ title: "Reserva cancelada", description: "El crédito se ha devuelto si la cancelación es a tiempo.", variant: "success" });
      load();
    } else {
      const d = await res.json();
      toast({ title: d.error || "Error al cancelar", variant: "error" });
    }
    setCancelling(null);
  }

  function exportWeek() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const weekBookings = upcoming.filter((b) => {
      const s = new Date(b.startDatetime);
      return s >= start && s <= end;
    });
    if (weekBookings.length === 0) {
      toast({ title: "No hay reservas esta semana", variant: "error" });
      return;
    }
    downloadICS(weekBookings.map(toExport), "gymbook-semana.ics");
    toast({ title: `${weekBookings.length} clase${weekBookings.length !== 1 ? "s" : ""} exportada${weekBookings.length !== 1 ? "s" : ""} ✓`, variant: "success" });
  }

  return (
    <AppShell title="Mis reservas">
      <div className="p-4 max-w-2xl mx-auto">

        {/* Tabs + export */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-1">
            {(["upcoming", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  tab === t ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "upcoming" ? `Próximas (${upcoming.length})` : "Historial"}
              </button>
            ))}
          </div>
          {tab === "upcoming" && upcoming.length > 0 && (
            <button
              onClick={exportWeek}
              title="Exportar semana al calendario"
              aria-label="Exportar semana al calendario"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors text-xs font-semibold cursor-pointer border border-orange-100 min-h-[44px]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Semana
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3" aria-label="Cargando reservas..." aria-busy="true">
            {[1, 2, 3].map((i) => <BookingCardSkeleton key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-gray-300" aria-hidden="true" />
            </div>
            <p className="text-gray-500 font-medium">
              {tab === "upcoming" ? "No tienes reservas próximas" : "Sin historial aún"}
            </p>
            {tab === "upcoming" && (
              <a
                href="/book"
                className="mt-3 inline-flex items-center gap-1 text-orange-500 font-semibold text-sm hover:text-orange-600"
              >
                Reservar una sesión →
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((b) => {
              const isCancellable = b.status === "BOOKED" && new Date(b.startDatetime) > now;
              const exportB = toExport(b);

              return (
                <Card key={b.id} className="overflow-hidden">
                  <CardContent className="p-0 flex items-stretch">
                    {/* Color bar */}
                    <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: b.teacher.color }} />

                    <div className="flex-1 p-4 space-y-2 min-w-0">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{b.activity.name}</p>
                          {b.sessionType === "SGT" && (
                            <span className="inline-block text-[10px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-semibold">SGT</span>
                          )}
                        </div>
                        <StatusBadge status={b.status} />
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" aria-hidden="true" />
                          {b.teacher.user.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {b.space.name}
                        </span>
                      </div>

                      {/* Date/time */}
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDate(new Date(b.startDatetime))} · {formatTime(new Date(b.startDatetime))}–{formatTime(new Date(b.endDatetime))}
                      </div>

                      {b.notes && <p className="text-xs text-gray-400 italic">{b.notes}</p>}

                      {/* Action row */}
                      {b.status === "BOOKED" && (
                        <div className="flex items-center gap-2 pt-1">
                          {/* Google Calendar */}
                          <a
                            href={googleCalendarUrl(exportB)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
                            aria-label="Añadir a Google Calendar"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                            Google Cal
                          </a>

                          {/* Download ICS */}
                          <button
                            onClick={() => downloadICS([exportB], `gymbook-${b.id}.ics`)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
                            aria-label="Descargar archivo de calendario (.ics)"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            .ics
                          </button>

                          {/* Cancel */}
                          {isCancellable && (
                            <button
                              onClick={() => handleCancel(b.id)}
                              disabled={cancelling === b.id}
                              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              aria-label="Cancelar reserva"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                              Cancelar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
