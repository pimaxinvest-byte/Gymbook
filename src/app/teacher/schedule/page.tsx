"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PlanningCalendar } from "@/components/calendar/planning-calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarPlus, Clock, Download, Loader2, Plus, Timer } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Activity { id: string; name: string }
interface Space    { id: string; name: string }

const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// FC convention: 0=Sun 1=Mon … 6=Sat  →  display order Mon–Sun
const FC_DAYS_ORDERED = [1, 2, 3, 4, 5, 6, 0];

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
const SLOT_DURATIONS = [
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1 h 30" },
];

export default function TeacherSchedulePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAvail, setShowAvail] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [spaces,     setSpaces]     = useState<Space[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExportICS() {
    setExporting(true);
    try {
      // Fetch own teacher record via profile
      const [teachersRes, profileRes] = await Promise.all([
        fetch("/api/teachers"),
        fetch("/api/profile"),
      ]);
      const teachers = await teachersRes.json() as { id: string; user: { id: string } }[];
      const profile = await profileRes.json() as { id: string };
      const own = teachers.find((t) => t.user?.id === profile.id);
      if (!own) { toast({ title: "No se encontró tu perfil de profesor", variant: "error" }); setExporting(false); return; }
      await downloadICS(own.id);
    } catch {
      toast({ title: "Error al exportar", variant: "error" });
    }
    setExporting(false);
  }

  async function downloadICS(teacherId: string) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1); // Monday
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Sunday
    end.setHours(23, 59, 59, 999);

    const url = `/api/bookings/export-ics?teacherId=${teacherId}&start=${start.toISOString()}&end=${end.toISOString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: (d as { error?: string }).error || "Error al exportar", variant: "error" });
      return;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = start.toISOString().slice(0, 10);
    a.href = blobUrl;
    a.download = `gymbook-semana-${dateStr}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast({ title: "Agenda exportada", description: "Abre el archivo .ics con Google Calendar, Apple Calendar u Outlook", variant: "success" });
  }

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
          <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
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
            <span className="text-gray-400">· Click = detalle · Ctrl+Click = seleccionar múltiples</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportICS} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar semana
            </Button>
            <Button size="sm" onClick={() => setShowAvail(true)}>
              <Plus className="h-4 w-4" />
              Nueva disponibilidad
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-3">
          <PlanningCalendar onRefreshKey={refreshKey} />
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
  activities, spaces, loading: loadingMeta, onClose, onSaved,
}: {
  activities: Activity[];
  spaces:     Space[];
  loading:    boolean;
  onClose:    () => void;
  onSaved:    () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [startTime,    setStartTime]    = useState("09:00");
  const [endTime,      setEndTime]      = useState("13:00");
  const [slotDuration, setSlotDuration] = useState(60);
  const [activityId,   setActivityId]   = useState("");
  const [spaceId,      setSpaceId]      = useState("");
  const [sessionType,  setSessionType]  = useState<"INDIVIDUAL" | "SGT">("INDIVIDUAL");
  const [saving,       setSaving]       = useState(false);

  useEffect(() => { if (activities.length && !activityId) setActivityId(activities[0].id); }, [activities, activityId]);
  useEffect(() => { if (spaces.length    && !spaceId)    setSpaceId(spaces[0].id);         }, [spaces,     spaceId]);

  function toggleDay(d: number) {
    setSelectedDays((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  }

  const previews   = computeSlotPreviews(startTime, endTime, slotDuration);
  const rangeValid = timeToMins(endTime) - timeToMins(startTime) >= slotDuration;

  async function handleSave() {
    if (!selectedDays.length) { toast({ title: "Selecciona al menos un día", variant: "error" }); return; }
    if (!activityId || !spaceId) { toast({ title: "Selecciona actividad y espacio", variant: "error" }); return; }
    if (!rangeValid) { toast({ title: `La franja debe ser de al menos ${slotDuration} min`, variant: "error" }); return; }

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
        slotDuration,
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
        title: `✓ ${d.created} sesiones creadas`,
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
      <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-orange-500" />
            Nueva franja horaria recurrente
          </DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
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

            {/* Time range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Clock className="h-3.5 w-3.5 inline mr-1" />
                Franja horaria *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Inicio</p>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Fin</p>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`w-full h-12 rounded-xl border-2 px-3 text-sm focus:outline-none ${
                      rangeValid ? "border-gray-200 focus:border-orange-400" : "border-red-300"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Slot duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Timer className="h-3.5 w-3.5 inline mr-1" />
                Duración de cada sesión
              </label>
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

            {/* Preview */}
            {rangeValid && previews.length > 0 && (
              <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                <p className="text-xs font-semibold text-orange-700 mb-2">
                  Sesiones por día ({previews.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previews.map((p) => (
                    <span key={p} className="text-xs font-mono bg-white border border-orange-200 text-orange-800 rounded-lg px-2 py-1">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
              {activities.length === 0 ? (
                <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-3">No hay actividades configuradas. Contacta al administrador.</p>
              ) : (
                <select
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
                >
                  <option value="">— Selecciona actividad —</option>
                  {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>

            {/* Space */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sala / Espacio *</label>
              {spaces.length === 0 ? (
                <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-3">No hay espacios configurados. Contacta al administrador.</p>
              ) : (
                <select
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
                >
                  <option value="">— Selecciona sala —</option>
                  {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            <Button size="lg" className="w-full" onClick={handleSave} disabled={saving || !rangeValid}>
              {saving
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><CalendarPlus className="h-4 w-4" /> Crear franja ({previews.length} ses/día)</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
