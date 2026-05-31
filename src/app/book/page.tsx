"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/utils";
import { Loader2, User, MapPin, Clock, Check, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface AvailableSlot {
  id: string;
  startDatetime: string;
  endDatetime: string;
  status: "AVAILABLE";
  teacher: { id: string; color: string; user: { name: string } };
  activity: { name: string };
  space: { name: string };
}

interface CreditBalance {
  teacherId: string;
  balance: number;
}

export default function BookPage() {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; user: { name: string } }[]>([]);
  const [creditMap, setCreditMap] = useState<Record<string, number>>({});

  const loadCredits = useCallback(async () => {
    const res = await fetch("/api/credits");
    if (res.ok) {
      const data: CreditBalance[] = await res.json();
      const map: Record<string, number> = {};
      data.forEach((c) => { map[c.teacherId] = c.balance; });
      setCreditMap(map);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: "AVAILABLE", start: new Date().toISOString() });
    if (filterTeacher) params.set("teacherId", filterTeacher);
    const r = await fetch(`/api/bookings/calendar?${params}`);
    const events = await r.json();

    const now = new Date();
    const upcoming = events
      .filter((e: { start: string }) => new Date(e.start) > now)
      .slice(0, 50)
      .map((e: {
        id: string;
        start: string;
        end: string;
        extendedProps: { teacherName: string; activityName: string; spaceName: string; teacherId: string };
        backgroundColor: string;
      }) => ({
        id: e.id,
        startDatetime: e.start,
        endDatetime: e.end,
        status: "AVAILABLE" as const,
        teacher: { id: e.extendedProps.teacherId, color: e.backgroundColor, user: { name: e.extendedProps.teacherName } },
        activity: { name: e.extendedProps.activityName },
        space: { name: e.extendedProps.spaceName },
      }));

    setSlots(upcoming);
    setLoading(false);
  }, [filterTeacher]);

  useEffect(() => {
    fetch("/api/teachers").then((r) => r.json()).then(setTeachers);
    loadCredits();
  }, [loadCredits]);

  useEffect(() => { load(); }, [load]);

  async function handleBook(slotId: string) {
    setBookingId(slotId);
    const res = await fetch("/api/bookings/client-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: slotId }),
    });
    if (res.ok) {
      toast({ title: "¡Reserva confirmada!", description: "Se ha descontado 1 crédito de tu saldo.", variant: "success" });
      load();
      loadCredits();
    } else {
      const data = await res.json();
      toast({ title: data.error || "Error al reservar", variant: "error" });
    }
    setBookingId(null);
  }

  // Group by date
  const grouped = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    const date = new Date(slot.startDatetime).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  return (
    <AppShell title="Reservar sesión">
      <div className="p-4 max-w-2xl mx-auto">
        {/* Teacher filter */}
        <div className="mb-4">
          <select
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
            className="w-full h-11 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-orange-400 focus:outline-none cursor-pointer"
            aria-label="Filtrar por entrenador"
          >
            <option value="">Todos los entrenadores</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.user.name}</option>
            ))}
          </select>
        </div>

        {/* Credit summary */}
        {Object.keys(creditMap).length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {teachers
              .filter((t) => creditMap[t.id] !== undefined)
              .map((t) => {
                const bal = creditMap[t.id] ?? 0;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                      bal === 0
                        ? "bg-red-50 text-red-700 border border-red-100"
                        : bal <= 2
                        ? "bg-amber-50 text-amber-700 border border-amber-100"
                        : "bg-green-50 text-green-700 border border-green-100"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{t.user.name}</span>
                    <span className="ml-auto font-black">{bal}</span>
                  </div>
                );
              })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" aria-label="Cargando franjas..." />
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-gray-300" aria-hidden="true" />
            </div>
            <p className="text-gray-500 font-medium">No hay franjas disponibles</p>
            <p className="text-sm text-gray-400 mt-1">Prueba cambiando el filtro de entrenador</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([dateStr, daySlots]) => (
              <div key={dateStr}>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                  {formatDate(new Date(dateStr))}
                </h3>
                <div className="space-y-2">
                  {daySlots.map((slot) => {
                    const credits = creditMap[slot.teacher.id];
                    const hasCredits = credits === undefined || credits > 0;
                    const creditsAssigned = credits !== undefined;

                    return (
                      <Card key={slot.id} className={`overflow-hidden transition-opacity ${!hasCredits ? "opacity-60" : ""}`}>
                        <CardContent className="p-0 flex items-stretch">
                          {/* Color bar */}
                          <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: slot.teacher.color }} />

                          <div className="flex-1 p-4 flex items-center justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm">{slot.activity.name}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" aria-hidden="true" />
                                  {slot.teacher.user.name}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" aria-hidden="true" />
                                  {slot.space.name}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  {formatTime(new Date(slot.startDatetime))}–{formatTime(new Date(slot.endDatetime))}
                                </span>
                              </div>

                              {/* Credit pill */}
                              {creditsAssigned && (
                                <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  credits === 0
                                    ? "bg-red-100 text-red-600"
                                    : credits <= 2
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-green-100 text-green-600"
                                }`}>
                                  <CreditCard className="h-2.5 w-2.5" aria-hidden="true" />
                                  {credits === 0 ? "Sin créditos" : `${credits} crédito${credits !== 1 ? "s" : ""}`}
                                </div>
                              )}
                            </div>

                            <div className="flex-shrink-0">
                              {!hasCredits ? (
                                <div className="flex items-center gap-1 text-xs text-red-500 font-medium">
                                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                  <span>Sin créditos</span>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleBook(slot.id)}
                                  disabled={bookingId === slot.id}
                                >
                                  {bookingId === slot.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <><Check className="h-4 w-4" aria-hidden="true" /> Reservar</>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
