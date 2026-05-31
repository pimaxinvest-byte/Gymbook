"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Calendar, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Activity { id: string; name: string }
interface Space { id: string; name: string }

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// FC uses 0=Sun, but we use 1=Mon…7=Sun internally
const FC_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

interface AvailSlot {
  id: string;
  day: number; // 1–7 (Mon–Sun, FC convention)
  startTime: string;
  endTime: string;
  activityName: string;
  spaceName: string;
  sessionType: string;
  bookingsCreated?: number;
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<AvailSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    // Load existing recurring rules for this teacher
    const [r, a, s] = await Promise.all([
      fetch("/api/bookings/recurrent?mine=true"),
      fetch("/api/activities"),
      fetch("/api/spaces"),
    ]);
    if (r.ok) {
      const rules = await r.json();
      setSlots(rules);
    }
    if (a.ok) setActivities(await a.json());
    if (s.ok) setSpaces(await s.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(ruleId: string) {
    if (!confirm("¿Eliminar esta disponibilidad recurrente y las reservas futuras no reservadas?")) return;
    const res = await fetch(`/api/bookings/recurrent/${ruleId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Disponibilidad eliminada", variant: "success" });
      load();
    } else {
      toast({ title: "Error al eliminar", variant: "error" });
    }
  }

  return (
    <AppShell title="Mis Disponibilidades">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{slots.length} patrón{slots.length !== 1 ? "es" : ""} recurrente{slots.length !== 1 ? "s" : ""}</p>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Nueva disponibilidad
          </Button>
        </div>

        {/* Info */}
        <div className="mb-4 rounded-2xl bg-orange-50 border border-orange-100 p-4 flex gap-3 items-start">
          <Calendar className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Disponibilidad recurrente</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Al añadir un patrón, se crean automáticamente franjas disponibles para los próximos 6 meses. Los clientes asignados podrán reservar estas franjas usando sus créditos.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium">Sin disponibilidades configuradas</p>
            <p className="text-sm mt-1">Añade un patrón para que tus clientes puedan reservar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              const dayIdx = FC_TO_IDX[slot.day] ?? 0;
              return (
                <Card key={slot.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Day badge */}
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-700 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black leading-none">{DAYS[dayIdx]}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {slot.startTime}–{slot.endTime}
                        <span className={`ml-2 text-[10px] rounded-full px-2 py-0.5 font-semibold ${slot.sessionType === "SGT" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                          {slot.sessionType === "SGT" ? "SGT" : "Individual"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 truncate">{slot.activityName} · {slot.spaceName}</p>
                      <p className="text-xs text-gray-400">{DAY_FULL[dayIdx]}s — cada semana</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {slot.bookingsCreated !== undefined && (
                        <span className="text-xs text-gray-400 mr-1">
                          <RefreshCw className="h-3 w-3 inline mr-0.5" />{slot.bookingsCreated}
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(slot.id)}
                        aria-label="Eliminar disponibilidad"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <AddAvailabilityModal
          activities={activities}
          spaces={spaces}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </AppShell>
  );
}

// ── Add Availability Modal ────────────────────────────────────────────────────

function AddAvailabilityModal({
  activities,
  spaces,
  onClose,
  onSaved,
}: {
  activities: Activity[];
  spaces: Space[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // 1=Mon FC
  const [startTime, setStartTime] = useState("09:00");
  const [activityId, setActivityId] = useState(activities[0]?.id || "");
  const [spaceId, setSpaceId] = useState(spaces[0]?.id || "");
  const [sessionType, setSessionType] = useState<"INDIVIDUAL" | "SGT">("INDIVIDUAL");
  const [loading, setLoading] = useState(false);

  // Derived end time = start + 60 min
  function addMinutes(time: string, minutes: number) {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  const endTime = addMinutes(startTime, 60);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    if (selectedDays.length === 0) {
      toast({ title: "Selecciona al menos un día", variant: "error" });
      return;
    }
    if (!activityId || !spaceId) {
      toast({ title: "Selecciona actividad y espacio", variant: "error" });
      return;
    }

    setLoading(true);

    // Calculate 6 months range
    const today = new Date();
    const sixMonths = new Date(today);
    sixMonths.setMonth(sixMonths.getMonth() + 6);

    const res = await fetch("/api/bookings/recurrent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daysOfWeek: selectedDays,
        startTime,
        endTime,
        startDate: today.toISOString(),
        endDate: sixMonths.toISOString(),
        activityId,
        spaceId,
        sessionType,
        capacity: sessionType === "SGT" ? 5 : 1,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      toast({
        title: "Disponibilidad creada",
        description: `${data.created} franjas generadas para los próximos 6 meses`,
        variant: "success",
      });
      onSaved();
    } else {
      const data = await res.json();
      toast({ title: data.error || "Error al crear disponibilidad", variant: "error" });
    }
    setLoading(false);
  }

  // FC days: 0=Sun, 1=Mon, ..., 6=Sat
  const FC_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun display order

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>Nueva disponibilidad recurrente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Day selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Días de la semana *</label>
            <div className="flex gap-1 flex-wrap">
              {FC_DAYS.map((fcDay, i) => (
                <button
                  key={fcDay}
                  type="button"
                  onClick={() => toggleDay(fcDay)}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                    selectedDays.includes(fcDay)
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {DAYS[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="av-time">
              Hora de inicio (la clase dura 60 min)
            </label>
            <input
              id="av-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400"
            />
            <p className="text-xs text-gray-400 mt-1">Fin: {endTime}</p>
          </div>

          {/* Session type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de sesión</label>
            <div className="grid grid-cols-2 gap-2">
              {(["INDIVIDUAL", "SGT"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSessionType(type)}
                  className={`h-12 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                    sessionType === type
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {type === "INDIVIDUAL" ? "Individual" : "SGT (máx 5)"}
                </button>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="av-activity">Actividad</label>
            <select
              id="av-activity"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Space */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="av-space">Espacio</label>
            <select
              id="av-space"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <Button size="lg" className="w-full" onClick={handleSave} disabled={loading}>
            {loading
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Generando franjas...</>
              : "Crear disponibilidad (6 meses)"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
