"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle, Users, User } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import type { Role } from "@prisma/client";

interface Teacher { id: string; user: { name: string }; color: string }
interface Space { id: string; name: string }
interface Activity { id: string; name: string }

interface CreateBookingModalProps {
  onClose: () => void;
  onCreated: () => void;
  role: Role;
  userId: string;
  defaultStart?: string;
  defaultTeacherId?: string;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function addMinutes(time: string, minutes: number) {
  const total = timeToMins(time) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function minsToTime(mins: number) {
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
function slotPreviews(startTime: string, endTime: string, slotDuration: number): string[] {
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

export function CreateBookingModal({
  onClose,
  onCreated,
  role,
  userId,
  defaultStart,
  defaultTeacherId,
}: CreateBookingModalProps) {
  const [isRecurring, setIsRecurring] = useState(false);
  const [sessionType, setSessionType] = useState<"INDIVIDUAL" | "SGT">("INDIVIDUAL");
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  void userId; // available for future use

  const [slotDuration, setSlotDuration] = useState(60); // minutes per slot
  const [rangeEndTime, setRangeEndTime] = useState("13:00"); // recurring: end of range

  const [form, setForm] = useState({
    teacherId: defaultTeacherId || "",
    spaceId: "",
    activityId: "",
    startDate: defaultStart?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    startTime: defaultStart?.slice(11, 16) || "09:00",
    notes: "",
    // Recurrence
    endDate: "",
    daysOfWeek: [] as number[],
  });

  // Single booking: end = start + slotDuration
  const singleEndTime = addMinutes(form.startTime, slotDuration);
  // Recurring: previews within the range
  const recurPreviews = slotPreviews(form.startTime, rangeEndTime, slotDuration);
  const rangeValid    = timeToMins(rangeEndTime) - timeToMins(form.startTime) >= slotDuration;

  useEffect(() => {
    fetch("/api/teachers").then((r) => r.json()).then(setTeachers);
    fetch("/api/spaces").then((r) => r.json()).then(setSpaces);
    fetch("/api/activities").then((r) => r.json()).then(setActivities);
  }, []);

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day],
    }));
  }

  async function handleSubmit() {
    if (!form.teacherId || !form.spaceId || !form.activityId) {
      toast({ title: "Completa todos los campos requeridos", variant: "error" });
      return;
    }

    if (isRecurring && form.daysOfWeek.length === 0) {
      toast({ title: "Selecciona al menos un día de la semana", variant: "error" });
      return;
    }

    if (isRecurring && !form.endDate) {
      toast({ title: "Indica la fecha de fin", variant: "error" });
      return;
    }

    setLoading(true);
    setConflicts([]);

    const capacity = sessionType === "SGT" ? 5 : 1;
    const endpoint = isRecurring ? "/api/bookings/recurrent" : "/api/bookings";

    const body = isRecurring
      ? {
          teacherId:    form.teacherId,
          spaceId:      form.spaceId,
          activityId:   form.activityId,
          startTime:    form.startTime,
          endTime:      rangeEndTime,
          slotDuration,
          startDate:    form.startDate,
          endDate:      form.endDate,
          daysOfWeek:   form.daysOfWeek,
          notes:        form.notes || undefined,
          sessionType,
          capacity,
        }
      : {
          teacherId:     form.teacherId,
          spaceId:       form.spaceId,
          activityId:    form.activityId,
          startDatetime: `${form.startDate}T${form.startTime}`,
          endDatetime:   `${form.startDate}T${singleEndTime}`,
          notes:         form.notes || undefined,
          sessionType,
          capacity,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.conflicts && data.conflicts.length > 0) {
        setConflicts(data.conflicts);
        toast({ title: `${data.skipped} conflictos, ${data.created || 0} creadas`, variant: "error" });
      } else {
        toast({ title: data.error || "Error al crear la reserva", variant: "error" });
      }
    } else {
      const count = isRecurring
        ? `${data.created} franja${data.created !== 1 ? "s" : ""} creada${data.created !== 1 ? "s" : ""}`
        : "Franja creada";
      toast({ title: count, variant: "success" });
      onCreated();
    }

    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir disponibilidad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Puntual / Recurrente toggle */}
          <div className="flex gap-2">
            {([false, true] as const).map((rec) => (
              <button
                key={String(rec)}
                type="button"
                onClick={() => setIsRecurring(rec)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                  isRecurring === rec
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {rec ? <><RefreshCw className="inline h-3.5 w-3.5 mr-1" />Recurrente</> : "Puntual"}
              </button>
            ))}
          </div>

          {/* Session type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de sesión</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSessionType("INDIVIDUAL")}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                  sessionType === "INDIVIDUAL"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => setSessionType("SGT")}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${
                  sessionType === "SGT"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                SGT (máx 5)
              </button>
            </div>
          </div>

          {/* Teacher (admin only) */}
          {role === "ADMIN" && (
            <FormSelect
              label="Profesor *"
              value={form.teacherId}
              onChange={(v) => setForm((f) => ({ ...f, teacherId: v }))}
              options={teachers.map((t) => ({ value: t.id, label: t.user.name }))}
            />
          )}

          {/* Space */}
          <FormSelect
            label="Espacio *"
            value={form.spaceId}
            onChange={(v) => setForm((f) => ({ ...f, spaceId: v }))}
            options={spaces.map((s) => ({ value: s.id, label: s.name }))}
          />

          {/* Activity */}
          <FormSelect
            label="Actividad *"
            value={form.activityId}
            onChange={(v) => setForm((f) => ({ ...f, activityId: v }))}
            options={activities.map((a) => ({ value: a.id, label: a.name }))}
          />

          {/* Date/time */}
          {isRecurring ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Días de la semana *</label>
                <div className="flex gap-1">
                  {DAYS.map((day, i) => {
                    // FC convention: 1=Mon..6=Sat, 0=Sun; our array: Lun=1, Mar=2... Dom=0
                    const fcDay = i < 6 ? i + 1 : 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(fcDay)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          form.daysOfWeek.includes(fcDay)
                            ? "bg-orange-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Fecha inicio *" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                <Input label="Fecha fin *" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </>
          ) : (
            <Input label="Fecha *" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          )}

          {/* Duration selector — always visible */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Duración de sesión</label>
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

          {/* Time — differs for single vs recurring */}
          {isRecurring ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Franja horaria *</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Inicio</p>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Fin de franja</p>
                  <input
                    type="time"
                    value={rangeEndTime}
                    onChange={(e) => setRangeEndTime(e.target.value)}
                    className={`w-full h-12 rounded-xl border-2 px-3 text-sm focus:outline-none ${
                      rangeValid ? "border-gray-200 focus:border-orange-400" : "border-red-300"
                    }`}
                  />
                </div>
              </div>
              {/* Slot preview */}
              {rangeValid && recurPreviews.length > 0 && (
                <div className="mt-2 rounded-xl bg-orange-50 border border-orange-200 p-2">
                  <p className="text-xs text-orange-700 font-medium mb-1">
                    {recurPreviews.length} sesión{recurPreviews.length !== 1 ? "es" : ""} por día:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {recurPreviews.map((p) => (
                      <span key={p} className="text-xs font-mono bg-white border border-orange-200 text-orange-800 rounded px-1.5 py-0.5">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label="Hora inicio *"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Fin</label>
                <div className="h-12 flex items-center px-4 rounded-xl bg-gray-50 border-2 border-gray-100 text-sm text-gray-500 font-medium">
                  {singleEndTime}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional..."
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none resize-none"
            />
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <p className="text-sm font-semibold text-amber-700">{conflicts.length} conflicto{conflicts.length !== 1 ? "s" : ""} omitido{conflicts.length !== 1 ? "s" : ""}</p>
              </div>
              <ul className="space-y-0.5">
                {conflicts.slice(0, 3).map((c, i) => (
                  <li key={i} className="text-xs text-amber-600">{c}</li>
                ))}
                {conflicts.length > 3 && <li className="text-xs text-amber-500">+{conflicts.length - 3} más</li>}
              </ul>
            </div>
          )}

          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : isRecurring
                ? "Crear disponibilidad recurrente"
                : "Crear franja disponible"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-orange-400 focus:outline-none cursor-pointer"
      >
        <option value="">Seleccionar...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
