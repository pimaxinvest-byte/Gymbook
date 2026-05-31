"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { Loader2, User, MapPin, Clock, Dumbbell } from "lucide-react";

interface Booking {
  id: string;
  startDatetime: string;
  endDatetime: string;
  status: "AVAILABLE" | "BOOKED" | "CANCELLED" | "COMPLETED" | "BLOCKED";
  teacher: { color: string; user: { name: string } };
  activity: { name: string };
  space: { name: string };
  notes?: string;
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");

  useEffect(() => {
    fetch("/api/bookings").then((r) => r.json()).then((data) => {
      setBookings(data.bookings || []);
      setLoading(false);
    });
  }, []);

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.startDatetime) >= now && b.status === "BOOKED");
  const history = bookings.filter((b) => new Date(b.startDatetime) < now || b.status !== "BOOKED");

  const displayed = tab === "upcoming" ? upcoming : history;

  return (
    <AppShell title="Mis reservas">
      <div className="p-4 max-w-2xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
          {(["upcoming", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"
              }`}
            >
              {t === "upcoming" ? `Próximas (${upcoming.length})` : "Historial"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500 font-medium">
              {tab === "upcoming" ? "No tienes reservas próximas" : "Sin historial aún"}
            </p>
            {tab === "upcoming" && (
              <a href="/book" className="mt-3 inline-block text-indigo-600 font-semibold text-sm">
                Reservar una sesión →
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((b) => (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="p-0 flex items-stretch">
                  <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: b.teacher.color }} />
                  <div className="flex-1 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900 text-sm">{b.activity.name}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{b.teacher.user.name}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.space.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                      <Clock className="h-3 w-3" />
                      {formatDate(new Date(b.startDatetime))} · {formatTime(new Date(b.startDatetime))}–{formatTime(new Date(b.endDatetime))}
                    </div>
                    {b.notes && <p className="text-xs text-gray-400 italic">{b.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
