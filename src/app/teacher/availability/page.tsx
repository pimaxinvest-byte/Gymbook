"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Calendar, Clock, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Activity { id: string; name: string }
interface Space    { id: string; name: string }

const DAYS     = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// FC uses 0=Sun, but we use 1=Mon…7=Sun internally
const FC_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

const SLOT_DURATIONS = [
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1 h 30" },
];

interface AvailSlot {
  id:              string;
  day:             number; // 1–7 (Mon–Sun, FC convention)
  startTime:       string;
  endTime:         string;
  slotDuration:    number;
  slotsPerDay:     number;
  activityName:    string;
  spaceName:       string;
  sessionType:     string;
  bookingsCreated?: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minsToTime(mins: number) {
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
function computeSlotPreviews(startTime: string, endTime: string, slotDuration: number): string[] {
  const out: string[] = [];
  let t = timeToMins(startTime);
  const end = timeToMins(endTime);
  while (t + slotDuration <= end) {
    out.push(`${minsToTime(t)}–${minsToTime(t + slotDuration)}`);
    t += slotDuration;
  }
  return out;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AvailabilityPage() {
  const [slots,    setSlots]    = useState<AvailSlot[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [spaces,     setSpaces]     = useState<Space[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, a, s] = await Promise.all([
      fetch("/api/bookings/recurrent?mine=true"),
      fetch("/api/activities"),
      fetch("/api/spaces"),
    ]);
    if (r.ok) setSlots(await r.json());
    if (a.ok) setActivities(await a.json());
    if (s.ok) setSpaces(await s.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(ruleId: string) {
    if (!confirm("¿Eliminar esta franja horaria recurrente y las reservas futuras no reservadas?")) return;
    const res = await fetch(`/api/bookings/recurrent/${ruleId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Franja horaria eliminada", variant: "success" });
      load();
    } else {
      toast({ title: "Error al eliminar", variant: "error" });
    }
  }

  return (
    <AppShell title="Mis Disponibilidades">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {slots.length} franja{slots.length !== 1 ? "s" : ""} recurrente{slots.length !== 1 ? "s" : ""}
          </p>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Nueva franja horaria
          </Button>
        </div>

        {/* Info banner */}
        <div className="mb-4 rounded-2xl bg-orange-50 border border-orange-100 p-4 flex gap-3 items-start">
          <Calendar className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Franjas horarias recurrentes</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Define la franja horaria que estarás disponible cada semana (ej. 14:00 – 18:00).
              El sistema genera automáticamente las sesiones dentro de esa franja para los próximos 6 meses.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium">Sin franjas horarias configuradas</p>
            <p className="text-sm mt-1">Añade una franja para que tus clientes puedan reservar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => {
              const dayIdx     = FC_TO_IDX[slot.day] ?? 0;
              const slotsCount = slot.slotsPerDay ?? 1;
              const durMin     = slot.slotDuration ?? 60;
              const durLabel   = durMin >= 60
                ? durMin % 60 === 0 ? `${durMin / 60}h` : `${Math.floor(durMin / 60)}h${durMin % 60}min`
                : `${durMin}min`;

              return (
                <Card key={slot.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Day badge */}
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-700 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black leading-none">{DAYS[dayIdx]}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Range + session count */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">
                          {slot.startTime} – {slot.endTime}
                        </p>
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                          {slotsCount} × {durLabel}
                        </span>
                        <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${
                          slot.sessionType === "SGT"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {slot.sessionType === "SGT" ? "SGT" : "Individual"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{slot.activityName} · {slot.spaceName}</p>
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
                        aria-label="Eliminar franja horaria"
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
  spaces:     Space[];
  onClose:    () => void;
  onSaved:    () => void;
}) {
  // FC days: 0=Sun, 1=Mon, ..., 6=Sat — display order Mon–Sun
  const FC_DAYS = [1, 2, 3, 4, 5, 6, 0];

  const [selectedDays,  setSelectedDays]  = useState<number[]>([1]); // 1=Mon FC
  const [startTime,     setStartTime]     = useState("09:00");
  const [endTime,       setEndTime]       = useState("13:00");
  const [slotDuration,  setSlotDuration]  = useState(60);
  const [activityId,    setActivityId]    = useState(activities[0]?.id || "");
  const [spaceId,       setSpaceId]       = useState(spaces[0]?.id || "");
  const [sessionType,   setSessionType]   = useState<"INDIVIDUAL" | "SGT">("INDIVIDUAL");
  const [loading,       setLoading]       = useState(false);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  // Computed slot previews
  const previews       = computeSlotPreviews(startTime, endTime, slotDuration);
  const rangeMinutes   = timeToMins(endTime) - timeToMins(startTime);
  const rangeValid     = rangeMinutes >= slotDuration;

  async function handleSave() {
    if (selectedDays.length === 0) {
      toast({ title: "Selecciona al menos un día", variant: "error" });
      return;
    }
    if (!activityId || !spaceId) {
      toast({ title: "Selecciona actividad y espacio", variant: "error" });
      return;
    }
    if (!rangeValid) {
      toast({ title: `La franja debe ser de al menos ${slotDuration} min`, variant: "error" });
      return;
    }

    setLoading(true);

    const today     = new Date();
    const sixMonths = new Date(today);
    sixMonths.setMonth(sixMonths.getMonth() + 6);

    const res = await fetch("/api/bookings/recurrent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daysOfWeek:   selectedDays,
        startTime,
        endTime,
        slotDuration,
        startDate:    today.toISOString(),
        endDate:      sixMonths.toISOString(),
        activityId,
        spaceId,
        sessionType,
        capacity:     sessionType === "SGT" ? 5 : 1,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      toast({
        title: "Franja horaria creada",
        description: `${data.created} sesiones generadas para los próximos 6 meses`,
        variant: "success",
      });
      onSaved();
    } else {
      const data = await res.json();
      toast({ title: data.error || "Error al crear la franja", variant: "error" });
    }
    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Nueva franja horaria recurrente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Days */}
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
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {DAYS[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Franja horaria *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Inicio</p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Fin</p>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={`w-full h-12 rounded-xl border-2 px-3 text-sm text-gray-900 focus:outline-none ${
                    rangeValid ? "border-gray-200 focus:border-orange-400" : "border-red-300 focus:border-red-400"
                  }`}
                />
              </div>
            </div>
            {!rangeValid && (
              <p className="text-xs text-red-500 mt-1">
                La franja debe ser de al menos {slotDuration} min
              </p>
            )}
          </div>

          {/* Slot duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Duración de cada sesión</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SLOT_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setSlotDuration(d.value)}
                  className={`h-10 rounded-xl text-xs font-semibold border-2 transition-colors cursor-pointer ${
                    slotDuration === d.value
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slot preview */}
          {rangeValid && previews.length > 0 && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs font-semibold text-orange-700 mb-2">
                Sesiones que se abrirán cada día seleccionado ({previews.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {previews.map((p) => (
                  <span
                    key={p}
                    className="text-xs font-mono bg-white border border-orange-200 text-orange-800 rounded-lg px-2 py-1"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <p className="text-xs text-orange-600 mt-2">
                × {selectedDays.length} día{selectedDays.length !== 1 ? "s" : ""} × 26 semanas ≈{" "}
                <strong>{previews.length * selectedDays.length * 26} sesiones</strong> en total
              </p>
            </div>
          )}

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

          <Button
            size="lg"
            className="w-full"
            onClick={handleSave}
            disabled={loading || !rangeValid}
          >
            {loading
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Generando sesiones...</>
              : `Crear franja (${previews.length} ses/día × 6 meses)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
