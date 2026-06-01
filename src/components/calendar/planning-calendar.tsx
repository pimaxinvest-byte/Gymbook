"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { BookingDetailModal } from "@/components/booking/booking-detail-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { Users, X, Copy, Loader2, CalendarCheck } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
    teacherId: string;
  };
}

interface SelectedSlot {
  id: string;
  start: string;
  status: string;
  activityName: string;
}

interface Client {
  id: string;
  user: { name: string };
}

interface PlanningCalendarProps {
  teacherFilter?: string;
  onRefreshKey?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanningCalendar({ teacherFilter, onRefreshKey }: PlanningCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<SelectedSlot[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  const currentRangeRef = useRef<{ start: string; end: string } | null>(null);

  const fetchEvents = useCallback(async (start: string, end: string) => {
    currentRangeRef.current = { start, end };
    const params = new URLSearchParams({ start, end });
    if (teacherFilter) params.set("teacherId", teacherFilter);
    const res = await fetch(`/api/bookings/calendar?${params}`);
    if (res.ok) setEvents(await res.json());
  }, [teacherFilter]);

  const refresh = useCallback(() => {
    const r = currentRangeRef.current;
    if (r) fetchEvents(r.start, r.end);
  }, [fetchEvents]);

  useEffect(() => { if (onRefreshKey !== undefined) refresh(); }, [onRefreshKey, refresh]);

  function toggleSelect(event: CalendarEvent) {
    const slot: SelectedSlot = {
      id: event.id,
      start: event.start,
      status: event.extendedProps.status,
      activityName: event.extendedProps.activityName,
    };
    setSelected(prev => {
      const exists = prev.find(s => s.id === event.id);
      return exists ? prev.filter(s => s.id !== event.id) : [...prev, slot];
    });
  }

  function isSelected(id: string) { return selected.some(s => s.id === id); }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async function bulkClose() {
    const toClose = selected.filter(s => s.status === "AVAILABLE");
    if (!toClose.length) { toast({ title: "Selecciona huecos disponibles", variant: "error" }); return; }
    if (!confirm(`¿Cerrar ${toClose.length} hueco${toClose.length > 1 ? "s" : ""} de disponibilidad?`)) return;

    await Promise.all(toClose.map(s => fetch(`/api/bookings/${s.id}`, { method: "DELETE" })));
    toast({ title: `${toClose.length} huecos cerrados ✓`, variant: "success" });
    setSelected([]);
    refresh();
  }

  async function bulkCancel() {
    const toCancel = selected.filter(s => s.status === "BOOKED");
    if (!toCancel.length) { toast({ title: "Selecciona sesiones reservadas", variant: "error" }); return; }
    if (!confirm(`¿Cancelar ${toCancel.length} sesión${toCancel.length > 1 ? "es" : ""}?`)) return;

    await Promise.all(toCancel.map(s =>
      fetch(`/api/bookings/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
    ));
    toast({ title: `${toCancel.length} sesiones canceladas ✓`, variant: "success" });
    setSelected([]);
    refresh();
  }

  async function bulkOpen() {
    // Re-open AVAILABLE slots that were deleted — not possible without re-creating them.
    // Instead, allow user to mark CANCELLED slots back to AVAILABLE.
    const toCancelled = selected.filter(s => s.status === "CANCELLED");
    if (!toCancelled.length) { toast({ title: "Selecciona sesiones canceladas para reabrir", variant: "error" }); return; }
    await Promise.all(toCancelled.map(s =>
      fetch(`/api/bookings/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "AVAILABLE" }),
      })
    ));
    toast({ title: `${toCancelled.length} sesiones reabiertas ✓`, variant: "success" });
    setSelected([]);
    refresh();
  }

  const hasAvailable = selected.some(s => s.status === "AVAILABLE");
  const hasBooked    = selected.some(s => s.status === "BOOKED");

  return (
    <>
      <style>{`
        .fc-event-available { opacity: 0.55 !important; border-style: dashed !important; }
        .fc-event-available:hover { opacity: 0.85 !important; }
        .fc-event-selected { outline: 3px solid #fff !important; box-shadow: 0 0 0 4px #f97316 !important; z-index: 10; }
        .planning-cal .fc-toolbar-title { font-size: 1rem; font-weight: 700; }
        .planning-cal .fc-button { border-radius: 8px !important; font-size: 0.75rem !important; padding: 4px 8px !important; }
        .planning-cal .fc-button-primary { background-color: #f97316 !important; border-color: #f97316 !important; }
        .planning-cal .fc-button-primary:not(.fc-button-active):hover { background-color: #ea580c !important; }
        .planning-cal .fc-button-active { background-color: #c2410c !important; border-color: #c2410c !important; }
        .planning-cal .fc-now-indicator-line { border-color: #f97316 !important; }
        .planning-cal .fc-timegrid-event .fc-event-main { padding: 2px 4px; }
      `}</style>

      {/* Selection action bar */}
      {selected.length > 0 && (
        <div className="sticky top-0 z-30 bg-orange-500 text-white rounded-xl mb-3 px-4 py-2.5 flex items-center gap-2 flex-wrap shadow-lg">
          <span className="text-sm font-bold mr-1">{selected.length} seleccionado{selected.length > 1 ? "s" : ""}</span>

          {hasAvailable && (
            <Button size="sm" variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-xs" onClick={bulkClose}>
              <X className="h-3.5 w-3.5" /> Cerrar disponibilidad
            </Button>
          )}
          {hasBooked && (
            <>
              <Button size="sm" variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-xs" onClick={() => setShowAssign(true)}>
                <Users className="h-3.5 w-3.5" /> Asignar cliente
              </Button>
              <Button size="sm" variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-xs" onClick={bulkCancel}>
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </>
          )}
          {selected.length > 0 && (
            <Button size="sm" variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-xs" onClick={() => setShowCopy(true)}>
              <Copy className="h-3.5 w-3.5" /> Copiar {selected.length > 1 ? "selección" : "slot"} X semanas
            </Button>
          )}

          <button onClick={() => setSelected([])} className="ml-auto text-white/70 hover:text-white cursor-pointer" aria-label="Deseleccionar todo">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="planning-cal">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          timeZone="Europe/Madrid"
          initialView="timeGridWeek"
          headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek" }}
          buttonText={{ today: "Hoy", day: "Día", week: "Semana" }}
          locale="es"
          firstDay={1}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          height="auto"
          nowIndicator
          events={events}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          datesSet={(info: any) => fetchEvents(info.startStr, info.endStr)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventClick={(info: any) => {
            const ev = events.find(e => e.id === info.event.id);
            if (!ev) return;
            if (selected.length > 0 || info.jsEvent.shiftKey || info.jsEvent.ctrlKey || info.jsEvent.metaKey) {
              // Multi-select mode: toggle selection
              toggleSelect(ev);
            } else {
              // Single click without modifier: open detail
              setDetailId(info.event.id);
            }
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventDidMount={(info: any) => {
            // Add visual indicator when selected
            const update = () => {
              const sel = isSelected(info.event.id);
              if (sel) info.el.classList.add("fc-event-selected");
              else info.el.classList.remove("fc-event-selected");
            };
            update();
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventContent={(info: any) => {
            const ep = info.event.extendedProps;
            const isSGT = ep.sessionType === "SGT";
            const sel = isSelected(info.event.id);
            return (
              <div className={`px-1 py-0.5 overflow-hidden h-full ${sel ? "ring-2 ring-white rounded" : ""}`}>
                {sel && <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white flex items-center justify-center"><CalendarCheck className="h-2 w-2 text-orange-500" /></span>}
                <div className="font-semibold text-[11px] leading-tight truncate">
                  {ep.activityName}
                  {isSGT && <span className="ml-1 text-[9px] bg-white/30 rounded px-1">SGT {ep.occupancy}/{ep.capacity}</span>}
                </div>
                <div className="text-[10px] opacity-80 truncate">
                  {ep.clientName ?? (ep.status === "AVAILABLE" ? "Disponible" : "")}
                </div>
              </div>
            );
          }}
          dayMaxEvents={4}
        />
      </div>

      {/* Booking detail (single click) */}
      {detailId && (
        <BookingDetailModal
          bookingId={detailId}
          onClose={() => setDetailId(null)}
          onUpdate={() => { setDetailId(null); refresh(); }}
        />
      )}

      {/* Bulk assign to client */}
      {showAssign && (
        <BulkAssignModal
          slots={selected.filter(s => s.status === "BOOKED")}
          onClose={() => setShowAssign(false)}
          onDone={() => { setShowAssign(false); setSelected([]); refresh(); }}
        />
      )}

      {/* Copy X weeks */}
      {showCopy && (
        <CopyWeeksModal
          slots={selected}
          onClose={() => setShowCopy(false)}
          onDone={() => { setShowCopy(false); setSelected([]); refresh(); }}
        />
      )}
    </>
  );
}

// ─── Bulk Assign Modal ────────────────────────────────────────────────────────

function BulkAssignModal({
  slots,
  onClose,
  onDone,
}: {
  slots: SelectedSlot[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/clients")
      .then(r => r.json())
      .then((assignments: { client: Client }[]) => {
        setClients(assignments.map(a => a.client));
        setLoadingClients(false);
      });
  }, []);

  async function handleAssign() {
    if (!clientId) { toast({ title: "Selecciona un cliente", variant: "error" }); return; }
    setLoading(true);
    const results = await Promise.all(slots.map(s =>
      fetch("/api/bookings/teacher-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: s.id, clientId }),
      })
    ));
    const ok = results.filter(r => r.ok).length;
    const fail = results.length - ok;
    toast({
      title: `${ok} sesión${ok > 1 ? "es" : ""} reservada${ok > 1 ? "s" : ""} ✓`,
      description: fail > 0 ? `${fail} fallaron (sin créditos o ya reservadas)` : undefined,
      variant: ok > 0 ? "success" : "error",
    });
    setLoading(false);
    onDone();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader><DialogTitle>Asignar cliente a {slots.length} sesión{slots.length > 1 ? "es" : ""}</DialogTitle></DialogHeader>
        {loadingClients ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-32 overflow-y-auto rounded-xl border border-gray-100 divide-y">
              {slots.map(s => (
                <div key={s.id} className="px-3 py-2 text-xs text-gray-600">
                  {new Date(s.start).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {s.activityName}
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
              >
                <option value="">Selecciona cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.user.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Se descontará 1 crédito por sesión al cliente seleccionado.
            </p>
            <Button size="lg" className="w-full" onClick={handleAssign} disabled={loading || !clientId}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Users className="h-4 w-4" /> Confirmar asignación</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Copy X Weeks Modal ───────────────────────────────────────────────────────

function CopyWeeksModal({
  slots,
  onClose,
  onDone,
}: {
  slots: SelectedSlot[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [weeks, setWeeks] = useState(1);
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    if (weeks < 1 || weeks > 52) return;
    setCopying(true);

    const res = await fetch("/api/bookings/copy-weeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingIds: slots.map(s => s.id), weeks }),
    });
    const d = await res.json();
    if (res.ok) {
      toast({
        title: `${d.created} sesiones copiadas ✓`,
        description: d.skipped ? `${d.skipped} omitidas por conflicto` : `Reproducidas ${weeks} semana${weeks > 1 ? "s" : ""} adelante`,
        variant: "success",
      });
      onDone();
    } else {
      toast({ title: d.error || "Error al copiar", variant: "error" });
    }
    setCopying(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs mx-4">
        <DialogHeader><DialogTitle>Reproducir selección</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Copia los <strong>{slots.length}</strong> slot{slots.length > 1 ? "s" : ""} seleccionado{slots.length > 1 ? "s" : ""} exactamente X semanas hacia adelante.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Número de semanas</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setWeeks(w => Math.max(1, w - 1))} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200 cursor-pointer">−</button>
              <input
                type="number"
                value={weeks}
                min={1} max={52}
                onChange={e => setWeeks(Math.max(1, Math.min(52, Number(e.target.value))))}
                className="w-16 h-10 text-center text-xl font-bold rounded-xl border-2 border-orange-300 focus:outline-none focus:border-orange-500"
              />
              <button onClick={() => setWeeks(w => Math.min(52, w + 1))} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-bold text-lg hover:bg-gray-200 cursor-pointer">+</button>
            </div>
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            Solo se copian los huecos DISPONIBLES. Los ya reservados se omiten si hay conflicto.
          </p>
          <Button size="lg" className="w-full" onClick={handleCopy} disabled={copying || weeks < 1}>
            {copying ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Copy className="h-4 w-4" /> Copiar {weeks} semana{weeks > 1 ? "s" : ""}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
