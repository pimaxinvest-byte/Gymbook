"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { Loader2, User, MapPin, Clock, Check } from "lucide-react";
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

export default function BookPage() {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [teachers, setTeachers] = useState<{ id: string; user: { name: string } }[]>([]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ status: "AVAILABLE", start: new Date().toISOString() });
    if (filterTeacher) params.set("teacherId", filterTeacher);
    const r = await fetch(`/api/bookings/calendar?${params}`);
    const events = await r.json();

    // Convert calendar events to slot objects
    const now = new Date();
    const upcoming = events
      .filter((e: { start: string }) => new Date(e.start) > now)
      .slice(0, 50)
      .map((e: { id: string; start: string; end: string; extendedProps: { teacherName: string; activityName: string; spaceName: string; teacherId: string }; backgroundColor: string }) => ({
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
  }

  useEffect(() => {
    fetch("/api/teachers").then((r) => r.json()).then(setTeachers);
  }, []);

  useEffect(() => { load(); }, [filterTeacher]);

  async function handleBook(slotId: string) {
    setBookingId(slotId);
    const res = await fetch("/api/bookings/client-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: slotId }),
    });
    if (res.ok) {
      toast({ title: "¡Reserva confirmada! 🎉", description: "Recibirás una confirmación por Telegram.", variant: "success" });
      load();
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
            className="w-full h-11 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Todos los profesores</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.user.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-gray-500 font-medium">No hay franjas disponibles</p>
            <p className="text-sm text-gray-400 mt-1">Prueba cambiando el filtro de profesor</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([dateStr, daySlots]) => (
              <div key={dateStr}>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                  {formatDate(new Date(dateStr))}
                </h3>
                <div className="space-y-2">
                  {daySlots.map((slot) => (
                    <Card key={slot.id} className="overflow-hidden">
                      <CardContent className="p-0 flex items-stretch">
                        {/* Color bar */}
                        <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: slot.teacher.color }} />

                        <div className="flex-1 p-4 flex items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{slot.activity.name}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><User className="h-3 w-3" />{slot.teacher.user.name}</span>
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.space.name}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(new Date(slot.startDatetime))}–{formatTime(new Date(slot.endDatetime))}</span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleBook(slot.id)}
                            disabled={bookingId === slot.id}
                            className="flex-shrink-0"
                          >
                            {bookingId === slot.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><Check className="h-4 w-4" /> Reservar</>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
