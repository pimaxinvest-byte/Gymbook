"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
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

export function CreateBookingModal({
  onClose,
  onCreated,
  role,
  userId,
  defaultStart,
  defaultTeacherId,
}: CreateBookingModalProps) {
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [form, setForm] = useState({
    teacherId: defaultTeacherId || "",
    spaceId: "",
    activityId: "",
    startDate: defaultStart?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    startTime: defaultStart?.slice(11, 16) || "09:00",
    endTime: "10:00",
    notes: "",
    // Recurrence
    endDate: "",
    daysOfWeek: [] as number[],
  });

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

    setLoading(true);
    setConflicts([]);

    const endpoint = isRecurring ? "/api/bookings/recurrent" : "/api/bookings";
    const body = isRecurring
      ? {
          teacherId: form.teacherId,
          spaceId: form.spaceId,
          activityId: form.activityId,
          startTime: form.startTime,
          endTime: form.endTime,
          startDate: form.startDate,
          endDate: form.endDate,
          daysOfWeek: form.daysOfWeek,
          notes: form.notes,
        }
      : {
          teacherId: form.teacherId,
          spaceId: form.spaceId,
          activityId: form.activityId,
          startDatetime: `${form.startDate}T${form.startTime}`,
          endDatetime: `${form.startDate}T${form.endTime}`,
          notes: form.notes,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.conflicts) {
        setConflicts(data.conflicts);
      } else {
        toast({ title: data.error || "Error al crear la reserva", variant: "error" });
      }
    } else {
      const count = isRecurring ? `${data.created} reservas creadas` : "Reserva creada";
      toast({ title: count, variant: "success" });
      onCreated();
    }

    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recurrence toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsRecurring(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                !isRecurring ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"
              }`}
            >
              Puntual
            </button>
            <button
              onClick={() => setIsRecurring(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                isRecurring ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"
              }`}
            >
              <RefreshCw className="inline h-3.5 w-3.5 mr-1" />
              Recurrente
            </button>
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
              {/* Days of week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Días de la semana *</label>
                <div className="flex gap-1.5">
                  {DAYS.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i + 1)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        form.daysOfWeek.includes(i + 1)
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Fecha inicio *" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                <Input label="Fecha fin *" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                <Input label="Hora inicio *" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                <Input label="Hora fin *" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <Input label="Fecha *" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="col-span-3 grid grid-cols-2 gap-3">
                <Input label="Hora inicio *" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                <Input label="Hora fin *" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
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
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-semibold text-orange-700">{conflicts.length} conflictos encontrados</p>
              </div>
              <ul className="space-y-1">
                {conflicts.slice(0, 3).map((c, i) => (
                  <li key={i} className="text-xs text-orange-600">{c}</li>
                ))}
                {conflicts.length > 3 && <li className="text-xs text-orange-500">+{conflicts.length - 3} más</li>}
              </ul>
            </div>
          )}

          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isRecurring ? "Crear reservas" : "Crear reserva"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">Seleccionar...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
