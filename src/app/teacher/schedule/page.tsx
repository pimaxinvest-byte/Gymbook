"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GymCalendar } from "@/components/calendar/gym-calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarPlus, Clock, Loader2, Plus } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Activity { id: string; name: string }
interface Space    { id: string; name: string }

const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// FC convention: 0=Sun 1=Mon … 6=Sat  →  display order Mon–Sun
const FC_DAYS_ORDERED = [1, 2, 3, 4, 5, 6, 0];

function addMinutes(time: string, m: number) {
  const [h, min] = time.split(":").map(Number);
  const t = h * 60 + min + m;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export default function TeacherSchedulePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAvail, setShowAvail] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [spaces,     setSpaces]     = useState<Space[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Lazy-load activities + spaces when modal opens
  useEffect(() => {
    if (!showAvail || activities.length) return;
    setLoadingMeta(true);
    Promise.all([
      fetch("/api/activities").then((r) => r.json()),
      fetch("/api/spaces").then((r) => r.json()),
    ]).then(([a, s]) => {
      setActivities(a);
      setSpaces(s);
      setLoadingMeta(false);
    });
  }, [showAvail, activities.length]);

  return (
    <AppShell title="Mi Planning Semanal">
      <div className="p-4">
        {/* Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded opacity-50 border-2 border-dashed border-orange-400 bg-orange-400 inline-block" />
              Disponible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded bg-orange-500 inline-block" />
              Reservado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded bg-purple-500 inline-block" />
              SGT
            </span>
          </div>
          <Button size="sm" onClick={() => setShowAvail(true)}>
            <Plus className="h-4 w-4" />
            Nueva disponibilidad
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-3">
          <GymCalendar key={refreshKey} initialView="timeGridWeek" />
        </div>
      </div>

      {showAvail && (
        <AddAvailabilityModal
          activities={activities}
          spaces={spaces}
          loading={loadingMeta}
          onClose={() => setShowAvail(false)}
          onSaved={() => { setShowAvail(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </AppShell>
  );
}

// ── Inline availability modal (recurring slots) ───────────────────────────────
function AddAvailabilityModal({
  activities, spaces, loading, onClose, onSaved,
}: {
  activities: Activity[];
  spaces:     Space[];
  loading:    boolean;
  onClose:    () => void;
  onSaved:    () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [startTime,    setStartTime]    = useState("09:00");
  const [activityId,   setActivityId]   = useState("");
  const [spaceId,      setSpaceId]      = useState("");
  const [sessionType,  setSessionType]  = useState<"INDIVIDUAL" | "SGT">("INDIVIDUAL");
  const [saving,       setSaving]       = useState(false);

  // Default selects when data arrives
  const prevActs = activities.length;
  useEffect(() => { if (activities.length && !activityId) setActivityId(activities[0].id); }, [activities, activityId]);
  useEffect(() => { if (spaces.length    && !spaceId)    setSpaceId(spaces[0].id);         }, [spaces,     spaceId]);
  void prevActs;

  const endTime = addMinutes(startTime, 60);

  function toggleDay(d: number) {
    setSelectedDays((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  }

  async function handleSave() {
    if (!selectedDays.length) { toast({ title: "Selecciona al menos un día", variant: "error" }); return; }
    if (!activityId || !spaceId) { toast({ title: "Selecciona actividad y espacio", variant: "error" }); return; }

    setSaving(true);
    const today     = new Date();
    const sixMonths = new Date(today);
    sixMonths.setMonth(sixMonths.getMonth() + 6);

    const res = await fetch("/api/bookings/recurrent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daysOfWeek:  selectedDays,
        startTime,
        endTime,
        startDate:   today.toISOString(),
        endDate:     sixMonths.toISOString(),
        activityId,
        spaceId,
        sessionType,
        capacity: sessionType === "SGT" ? 5 : 1,
      }),
    });

    if (res.ok) {
      const d = await res.json();
      toast({
        title: `✓ ${d.created} franjas creadas`,
        description: d.skipped ? `${d.skipped} omitidas por conflicto` : "Para los próximos 6 meses",
        variant: "success",
      });
      onSaved();
    } else {
      const d = await res.json();
      toast({ title: d.error || "Error", variant: "error" });
    }
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-orange-500" />
            Nueva disponibilidad recurrente
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>
        ) : (
          <div className="space-y-4">
            {/* Day selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Días de la semana *</p>
              <div className="flex gap-1.5 flex-wrap">
                {FC_DAYS_ORDERED.map((fcDay, i) => (
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
                    {DAYS_SHORT[i]}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="av-start">
                <Clock className="h-3.5 w-3.5 inline mr-1" />
                Hora de inicio
              </label>
              <input
                id="av-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"
              />
              <p className="text-xs text-gray-400 mt-1">Fin automático: {endTime} (60 min)</p>
            </div>

            {/* Session type */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tipo de sesión</p>
              <div className="grid grid-cols-2 gap-2">
                {(["INDIVIDUAL", "SGT"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSessionType(t)}
                    className={`h-12 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                      sessionType === t
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t === "INDIVIDUAL" ? "Individual" : "Grupo (SGT)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Actividad *</label>
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
              >
                <option value="">Selecciona...</option>
                {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Space */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Espacio *</label>
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
              >
                <option value="">Selecciona...</option>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <Button size="lg" className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CalendarPlus className="h-4 w-4" /> Crear disponibilidad</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
