"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, User, CreditCard, ChevronDown, ChevronUp, Check, CalendarPlus } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import Image from "next/image";

interface ClientInfo {
  id: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null; telegramChatId?: string | null };
  notes?: string | null;
}

interface Assignment {
  id: string;
  clientId: string;
  teacherId: string;
  client: { id: string; user: { id: string; name: string; email: string; avatarUrl?: string | null; telegramChatId?: string | null } };
  teacher: { id: string; user: { id: string; name: string; email: string } };
  assignedAt: string;
}

interface CreditRecord {
  id: string;
  balance: number;
  creditType: string;
  expiresAt?: string | null;
  isExpired?: boolean;
  transactions: {
    id: string;
    amount: number;
    type: string;
    note?: string | null;
    createdAt: string;
    createdBy: { name: string };
  }[];
}

interface AvailableSlot {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps: {
    teacherName: string;
    activityName: string;
    spaceName: string;
    sessionType: string;
    capacity: number;
    occupancy: number;
  };
}

export default function TeacherClientsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [credits, setCredits] = useState<Record<string, CreditRecord[]>>({});
  const [bookForClient, setBookForClient] = useState<{ clientId: string; clientName: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/teacher/clients");
    if (res.ok) setAssignments(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadCredits(clientId: string) {
    const res = await fetch(`/api/credits?clientId=${clientId}`);
    if (res.ok) {
      const data = await res.json();
      setCredits((prev) => ({ ...prev, [clientId]: data }));
    }
  }

  async function handleExpand(clientId: string, assignId: string) {
    const next = expandedId === assignId ? null : assignId;
    setExpandedId(next);
    if (next && !credits[clientId]) {
      await loadCredits(clientId);
    }
  }

  async function handleRemove(clientId: string) {
    if (!confirm("¿Desvincular este cliente de tu lista?")) return;
    const res = await fetch(`/api/teacher/clients?clientId=${clientId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Cliente desvinculado", variant: "success" });
      load();
    } else {
      toast({ title: "Error", variant: "error" });
    }
  }

  async function adjustCredit(clientId: string, creditType: "INDIVIDUAL" | "SGT", delta: number) {
    const res = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, creditType, amount: delta }),
    });
    if (res.ok) {
      toast({ title: delta > 0 ? "Crédito añadido ✓" : "Crédito descontado ✓", variant: "success" });
      await loadCredits(clientId);
    } else {
      const d = await res.json();
      toast({ title: d.error || "Error", variant: "error" });
    }
  }

  return (
    <AppShell title="Mis Clientes">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{assignments.length} cliente{assignments.length !== 1 ? "s" : ""}</p>
          {(role === "TEACHER" || role === "ADMIN") && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Añadir cliente
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <User className="h-12 w-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium">Sin clientes asignados</p>
            <p className="text-sm mt-1">Añade clientes para gestionar sus reservas y créditos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const c = a.client;
              const clientCredits = credits[c.id] || [];
              const isExpanded = expandedId === a.id;

              return (
                <Card key={a.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {c.user.avatarUrl ? (
                          <Image
                            src={c.user.avatarUrl}
                            alt={c.user.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
                            <User className="h-6 w-6 text-orange-400" aria-hidden="true" />
                          </div>
                        )}
                        {/* Telegram LED */}
                        {c.user.telegramChatId && (
                          <span
                            title="Telegram activo"
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white"
                            aria-label="Telegram conectado"
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{c.user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.user.email}</p>
                        {/* Quick credit summary */}
                        {clientCredits.length > 0 && (
                          <div className="flex gap-2 mt-1">
                            {clientCredits.map((cr) => (
                              <span
                                key={cr.id}
                                className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${
                                  cr.isExpired || cr.balance === 0
                                    ? "bg-red-100 text-red-600"
                                    : "bg-green-100 text-green-600"
                                }`}
                              >
                                <CreditCard className="h-2.5 w-2.5 inline mr-0.5" />
                                {cr.creditType === "SGT" ? "SGT" : "Ind"}: {cr.balance}
                                {cr.isExpired && " (exp)"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleExpand(c.id, a.id)}
                          aria-label={isExpanded ? "Ocultar ficha" : "Ver ficha"}
                          aria-expanded={isExpanded}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleRemove(c.id)}
                          aria-label={`Desvincular ${c.user.name}`}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded: credit management + log + book button */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">

                        {/* Book session for this client */}
                        <button
                          onClick={() => setBookForClient({ clientId: c.id, clientName: c.user.name })}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-50 border-2 border-orange-200 text-orange-600 font-semibold text-sm hover:bg-orange-100 transition-colors cursor-pointer"
                        >
                          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                          Reservar sesión para {c.user.name.split(" ")[0]}
                        </button>

                        {/* Credit controls */}
                        {(["INDIVIDUAL", "SGT"] as const).map((type) => {
                          const cr = clientCredits.find((x) => x.creditType === type);
                          const balance = cr?.balance ?? 0;
                          const expired = cr?.isExpired ?? false;
                          const expiresAt = cr?.expiresAt;

                          return (
                            <div key={type}>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <span className="text-sm font-semibold text-gray-700">
                                    Créditos {type === "SGT" ? "SGT" : "Individual"}
                                  </span>
                                  {expiresAt && (
                                    <p className={`text-xs ${expired ? "text-red-500" : "text-gray-400"}`}>
                                      {expired ? "Caducados" : "Caducan"}: {new Date(expiresAt).toLocaleDateString("es-ES")}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-black ${balance === 0 ? "text-red-500" : expired ? "text-amber-500" : "text-green-600"}`}>
                                    {balance}
                                  </span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => adjustCredit(c.id, type, -1)}
                                      disabled={balance === 0}
                                      aria-label={`Quitar crédito ${type}`}
                                      className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center text-lg font-bold"
                                    >
                                      −
                                    </button>
                                    <button
                                      onClick={() => adjustCredit(c.id, type, 1)}
                                      aria-label={`Añadir crédito ${type}`}
                                      className="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer flex items-center justify-center text-lg font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Transaction log */}
                              {cr && cr.transactions.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {cr.transactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center gap-2 text-xs">
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        tx.amount > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                                      }`}>
                                        {tx.amount > 0 ? "+" : "−"}
                                      </span>
                                      <span className="text-gray-600 flex-1 truncate">{tx.note || tx.type}</span>
                                      <span className="text-gray-400 flex-shrink-0">{new Date(tx.createdAt).toLocaleDateString("es-ES")}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
          isAdmin={role === "ADMIN"}
        />
      )}

      {bookForClient && (
        <BookForClientModal
          clientId={bookForClient.clientId}
          clientName={bookForClient.clientName}
          onClose={() => setBookForClient(null)}
          onBooked={() => {
            setBookForClient(null);
            // Refresh credits for the client
            setCredits((prev) => {
              const next = { ...prev };
              delete next[bookForClient.clientId];
              return next;
            });
            load();
          }}
        />
      )}
    </AppShell>
  );
}

// ── Book For Client Modal ─────────────────────────────────────────────────────

function BookForClientModal({
  clientId,
  clientName,
  onClose,
  onBooked,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    async function fetchSlots() {
      // Fetch available slots for the next 60 days
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `/api/bookings/calendar?status=AVAILABLE&start=${start}&end=${end}`
      );
      if (res.ok) {
        const data: AvailableSlot[] = await res.json();
        setSlots(data);
      }
      setLoadingSlots(false);
    }
    fetchSlots();
  }, []);

  async function handleBook() {
    if (!selectedId) return;
    setBooking(true);
    const res = await fetch("/api/bookings/teacher-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: selectedId, clientId }),
    });
    if (res.ok) {
      toast({ title: `Sesión reservada para ${clientName} ✓`, variant: "success" });
      onBooked();
    } else {
      const d = await res.json();
      toast({ title: d.error || "Error al reservar", variant: "error" });
    }
    setBooking(false);
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reservar sesión para {clientName.split(" ")[0]}</DialogTitle>
        </DialogHeader>

        {loadingSlots ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CalendarPlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">Sin franjas disponibles</p>
            <p className="text-xs mt-1">Abre disponibilidad desde tu planning</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 px-0.5 -mt-1">
              {slots.length} franja{slots.length !== 1 ? "s" : ""} disponible{slots.length !== 1 ? "s" : ""}
              {" "}· Se descontará 1 crédito
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 mt-1 pr-0.5">
              {slots.map((slot) => {
                const isSGT = slot.extendedProps.sessionType === "SGT";
                const isSelected = selectedId === slot.id;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedId(isSelected ? null : slot.id)}
                    className={`w-full text-left rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-100 bg-white hover:border-orange-200 hover:bg-orange-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900">
                          {slot.extendedProps.activityName}
                          {isSGT && (
                            <span className="ml-1.5 text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
                              SGT {slot.extendedProps.occupancy}/{slot.extendedProps.capacity}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDateTime(slot.start)} — {formatTime(slot.end)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{slot.extendedProps.spaceName}</p>
                      </div>
                      {isSelected && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              size="lg"
              className="w-full mt-3"
              onClick={handleBook}
              disabled={!selectedId || booking}
            >
              {booking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4" />
                  Confirmar reserva
                </>
              )}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Add Client Modal ──────────────────────────────────────────────────────────

function AddClientModal({
  onClose,
  onSaved,
  isAdmin,
}: {
  onClose: () => void;
  onSaved: () => void;
  isAdmin: boolean;
}) {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; user: { name: string } }[]>([]);
  const [clientId, setClientId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function load() {
      const [cr, tr] = await Promise.all([
        fetch("/api/clients"),
        isAdmin ? fetch("/api/teachers") : Promise.resolve(null),
      ]);
      if (cr.ok) setClients(await cr.json());
      if (tr?.ok) setTeachers(await tr.json());
      setLoadingData(false);
    }
    load();
  }, [isAdmin]);

  async function handleSave() {
    if (!clientId) { toast({ title: "Selecciona un cliente", variant: "error" }); return; }
    setLoading(true);
    const res = await fetch("/api/teacher/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, teacherId: isAdmin ? teacherId : undefined }),
    });
    if (res.ok) {
      toast({ title: "Cliente añadido ✓", variant: "success" });
      onSaved();
    } else {
      const d = await res.json();
      toast({ title: d.error || "Error", variant: "error" });
    }
    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>Añadir cliente</DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
        ) : (
          <div className="space-y-4">
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Entrenador</label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
                >
                  <option value="">Selecciona entrenador...</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400 cursor-pointer"
              >
                <option value="">Selecciona cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.user.name} ({c.user.email})</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2 items-start text-xs text-amber-700">
              <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              Cada cliente puede tener máximo 2 entrenadores asignados.
            </div>

            <Button size="lg" className="w-full" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Añadir cliente"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
