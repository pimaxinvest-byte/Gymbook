"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GymCalendar } from "@/components/calendar/gym-calendar";
import { Button } from "@/components/ui/button";
import { Filter, Plus } from "lucide-react";
import { CreateBookingModal } from "@/components/booking/create-booking-modal";
import type { Role } from "@prisma/client";

interface Teacher { id: string; user: { name: string }; color: string }
interface Activity { id: string; name: string }
interface Space { id: string; name: string }

export function CalendarPageClient({ role, userId }: { role: Role; userId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [filters, setFilters] = useState({
    teacherId: "",
    activityId: "",
    spaceId: "",
    status: "",
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/teachers").then((r) => r.json()).then(setTeachers);
    fetch("/api/activities").then((r) => r.json()).then(setActivities);
    fetch("/api/spaces").then((r) => r.json()).then(setSpaces);
  }, []);

  const canCreate = role === "ADMIN" || role === "TEACHER";

  return (
    <AppShell title="Calendario">
      <div className="p-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Nueva reserva
            </Button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3 animate-slideUp">
            <div className="grid grid-cols-2 gap-3">
              <FilterSelect
                label="Profesor"
                value={filters.teacherId}
                onChange={(v) => setFilters((f) => ({ ...f, teacherId: v }))}
                options={teachers.map((t) => ({ value: t.id, label: t.user.name }))}
              />
              <FilterSelect
                label="Actividad"
                value={filters.activityId}
                onChange={(v) => setFilters((f) => ({ ...f, activityId: v }))}
                options={activities.map((a) => ({ value: a.id, label: a.name }))}
              />
              <FilterSelect
                label="Espacio"
                value={filters.spaceId}
                onChange={(v) => setFilters((f) => ({ ...f, spaceId: v }))}
                options={spaces.map((s) => ({ value: s.id, label: s.name }))}
              />
              <FilterSelect
                label="Estado"
                value={filters.status}
                onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                options={[
                  { value: "AVAILABLE", label: "Disponible" },
                  { value: "BOOKED", label: "Reservado" },
                  { value: "CANCELLED", label: "Cancelado" },
                  { value: "COMPLETED", label: "Completado" },
                  { value: "BLOCKED", label: "Bloqueado" },
                ]}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 w-full"
              onClick={() => setFilters({ teacherId: "", activityId: "", spaceId: "", status: "" })}
            >
              Limpiar filtros
            </Button>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-3">
          <GymCalendar
            key={refreshKey}
            teacherFilter={filters.teacherId}
            activityFilter={filters.activityId}
            spaceFilter={filters.spaceId}
            statusFilter={filters.status}
            selectable={canCreate}
          />
        </div>
      </div>

      {showCreate && (
        <CreateBookingModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setRefreshKey((k) => k + 1);
          }}
          role={role}
          userId={userId}
        />
      )}
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
