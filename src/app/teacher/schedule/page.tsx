"use client";

import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { GymCalendar } from "@/components/calendar/gym-calendar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateBookingModal } from "@/components/booking/create-booking-modal";

export default function TeacherSchedulePage() {
  const { data: session } = useSession();
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell title="Mi Planning Semanal">
      <div className="p-4">
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Abrir disponibilidad
          </Button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded opacity-50 border-2 border-dashed border-orange-400 bg-orange-400" />
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-orange-500" />
            <span>Reservado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-purple-500" />
            <span>SGT</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-3">
          <GymCalendar
            key={refreshKey}
            initialView="timeGridWeek"
          />
        </div>
      </div>

      {showCreate && session && (
        <CreateBookingModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setRefreshKey((k) => k + 1);
          }}
          role="TEACHER"
          userId={session.user.id}
        />
      )}
    </AppShell>
  );
}
