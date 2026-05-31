"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";

import { BookingDetailModal } from "@/components/booking/booking-detail-modal";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  classNames: string[];
  extendedProps: {
    teacherName: string;
    clientName?: string;
    activityName: string;
    spaceName: string;
    status: string;
    sessionType: string;
    capacity: number;
    occupancy: number;
    isFull: boolean;
    notes?: string;
    teacherId: string;
    participantNames?: string[];
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
  onRefresh?: () => void;
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

  const refreshCalendar = useCallback(() => {
    const calApi = calendarRef.current?.getApi();
    if (calApi) {
      const view = calApi.view;
      fetchEvents(view.activeStart.toISOString(), view.activeEnd.toISOString());
    }
  }, [fetchEvents]);

  // Unused but kept to avoid ref warning
  useEffect(() => {}, []);

  return (
    <>
      <style>{`
        .fc-event-available {
          opacity: 0.52 !important;
          border-style: dashed !important;
        }
        .fc-event-available:hover {
          opacity: 0.85 !important;
        }
        .fc-timegrid-event .fc-event-main {
          padding: 2px 4px;
        }
        .gym-calendar .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 700;
        }
        .gym-calendar .fc-button {
          border-radius: 8px !important;
          font-size: 0.75rem !important;
          padding: 4px 8px !important;
        }
        .gym-calendar .fc-button-primary {
          background-color: #f97316 !important;
          border-color: #f97316 !important;
        }
        .gym-calendar .fc-button-primary:not(.fc-button-active):hover {
          background-color: #ea580c !important;
        }
        .gym-calendar .fc-button-active {
          background-color: #c2410c !important;
          border-color: #c2410c !important;
        }
        .gym-calendar .fc-now-indicator-line {
          border-color: #f97316 !important;
        }
      `}</style>

      <div className="gym-calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={initialView}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,listWeek",
          }}
          buttonText={{
            today: "Hoy",
            day: "Día",
            week: "Semana",
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
          eventContent={(info: any) => {
            const ep = info.event.extendedProps;
            const isSGT = ep.sessionType === "SGT";
            return (
              <div className="px-1 py-0.5 overflow-hidden h-full">
                <div className="font-semibold text-[11px] leading-tight truncate">
                  {ep.activityName}
                  {isSGT && <span className="ml-1 text-[9px] bg-white/30 rounded px-1">SGT {ep.occupancy}/{ep.capacity}</span>}
                </div>
                <div className="text-[10px] opacity-80 truncate">
                  {ep.teacherName}
                  {ep.clientName && ` · ${ep.clientName}`}
                </div>
              </div>
            );
          }}
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
              refreshCalendar();
            }}
          />
        )}
      </div>
    </>
  );
}
