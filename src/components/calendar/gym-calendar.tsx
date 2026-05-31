"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";

import { BookingDetailModal } from "@/components/booking/booking-detail-modal";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    teacherName: string;
    clientName?: string;
    activityName: string;
    spaceName: string;
    status: string;
    notes?: string;
    teacherId: string;
  };
}

interface GymCalendarProps {
  teacherFilter?: string;
  clientFilter?: string;
  activityFilter?: string;
  spaceFilter?: string;
  statusFilter?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDateSelect?: (info: any) => void;
  selectable?: boolean;
  initialView?: string;
}

export function GymCalendar({
  teacherFilter,
  clientFilter,
  activityFilter,
  spaceFilter,
  statusFilter,
  onDateSelect,
  selectable = false,
  initialView = "timeGridWeek",
}: GymCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = useCallback(async (start: string, end: string) => {
    const params = new URLSearchParams({ start, end });
    if (teacherFilter) params.set("teacherId", teacherFilter);
    if (clientFilter) params.set("clientId", clientFilter);
    if (activityFilter) params.set("activityId", activityFilter);
    if (spaceFilter) params.set("spaceId", spaceFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/bookings/calendar?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data);
    }
  }, [teacherFilter, clientFilter, activityFilter, spaceFilter, statusFilter]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEventClick(info: any) {
    setSelectedBooking(info.event.id);
  }

  return (
    <div className="gym-calendar">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: "prev,next",
          center: "title",
          right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
        }}
        buttonText={{
          day: "Día",
          week: "Semana",
          month: "Mes",
          list: "Lista",
        }}
        locale="es"
        firstDay={1}
        slotMinTime="06:00:00"
        slotMaxTime="23:00:00"
        allDaySlot={false}
        height="auto"
        events={events}
        eventClick={handleEventClick}
        select={onDateSelect}
        selectable={selectable}
        selectMirror={selectable}
        nowIndicator
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        datesSet={(info: any) => fetchEvents(info.startStr, info.endStr)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventContent={(info: any) => (
          <div className="fc-event-main-frame px-1 py-0.5 overflow-hidden">
            <div className="fc-event-title font-semibold text-xs leading-tight truncate">
              {info.event.extendedProps.activityName}
            </div>
            <div className="text-[10px] opacity-80 truncate">
              {info.event.extendedProps.teacherName}
              {info.event.extendedProps.clientName && ` · ${info.event.extendedProps.clientName}`}
            </div>
          </div>
        )}
        dayMaxEvents={4}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        moreLinkText={(n: any) => `+${n} más`}
      />

      {selectedBooking && (
        <BookingDetailModal
          bookingId={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdate={() => {
            setSelectedBooking(null);
            const calApi = calendarRef.current?.getApi();
            if (calApi) {
              const view = calApi.view;
              fetchEvents(view.activeStart.toISOString(), view.activeEnd.toISOString());
            }
          }}
        />
      )}
    </div>
  );
}
