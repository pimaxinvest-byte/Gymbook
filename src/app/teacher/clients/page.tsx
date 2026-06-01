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
  const [selfTeacherId, setSelfTeacherId] = useState<string | null>(null);

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

  // Resolve own teacher id for pre-filling assignment
  useEffect(() => {
    if (role === "TEACHER") {
      fetch("/api/teachers/me").then(r => r.ok ? r.json() : null).then(d => {
        if (d?.id) setSelfTeacherId(d.id);
      });
    }
  }, [role]);

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
          selfTeacherId={selfTeacherId}
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
// Two tabs: "Existente" (assign existing) | "Nuevo" (create brand-new client)

type Teacher = { id: string; user: { name: string } };

function AddClientModal({
  onClose,
  onSaved,
  isAdmin,
  selfTeacherId,
}: {
  onClose: () => void;
  onSaved: () => void;
  isAdmin: boolean;
  selfTeacherId: string | null;
}) {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [clients, setClients]   = useState<ClientInfo[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);

  // ── "Existente" state ──
  const [clientId, setClientId]   = useState("");
  const [teacher1, setTeacher1]   = useState(selfTeacherId ?? "");
  const [teacher2, setTeacher2]   = useState("");

  // ── "Nuevo" state ──
  const [newName,     setNewName]     = useState("");
  const [newEmail,    setNewEmail]    = useState("");
  const [newPhone,    setNewPhone]    = useState("");
  const [newTeacher1, setNewTeacher1] = useState(selfTeacherId ?? "");
  const [newTeacher2, setNewTeacher2] = useState("");

  useEffect(() => {
    async function load() {
      const [cr, tr] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/teachers"),
      ]);
      if (cr.ok) setClients(await cr.json());
      if (tr.ok) setTeachers(await tr.json());
      setLoadingData(false);
    }
    load();
  }, []);

  // ── Save existing client assignment ──
  async function handleSaveExisting() {
    if (!clientId) { toast({ title: "Selecciona un cliente", variant: "error" }); return; }
    if (!teacher1) { toast({ title: "Selecciona al menos un entrenador", variant: "error" }); return; }
    setLoading(true);

    // Assign to teacher1
    const r1 = await fetch("/api/teacher/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, teacherId: teacher1 }),
    });
    const d1 = await r1.json();
    if (!r1.ok && d1.error !== "Ya está asignado") {
      toast({ title: d1.error || "Error", variant: "error" });
      setLoading(false);
      return;
    }

    // Optionally assign to teacher2
    if (teacher2 && teacher2 !== teacher1) {
      const r2 = await fetch("/api/teacher/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, teacherId: teacher2 }),
      });
      const d2 = await r2.json();
      if (!r2.ok && d2.error !== "Ya está asignado") {
        toast({ title: d2.error || "Error asignando 2º entrenador", variant: "error" });
      }
    }

    toast({ title: "Cliente añadido ✓", variant: "success" });
    setLoading(false);
    onSaved();
  }

  // ── Save new client creation ──
  async function handleCreateNew() {
    if (!newName.trim()) { toast({ title: "Nombre requerido", variant: "error" }); return; }
    if (!newEmail.trim()) { toast({ title: "Email requerido", variant: "error" }); return; }
    if (!newTeacher1)    { toast({ title: "Selecciona al menos un entrenador", variant: "error" }); return; }
    setLoading(true);

    const teacherIds = [newTeacher1, ...(newTeacher2 && newTeacher2 !== newTeacher1 ? [newTeacher2] : [])];
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim() || undefined, teacherIds }),
    });
    const d = await res.json();
    if (res.ok) {
      toast({ title: "Cliente creado y asignado ✓", variant: "success" });
      onSaved();
    } else {
      toast({ title: d.error || "Error", variant: "error" });
    }
    setLoading(false);
  }

  const inputCls = "w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-orange-400";
  const teacherOptions = (exclude?: string) => teachers.filter(t => t.id !== exclude);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir cliente</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
          {(["existing", "new"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === t ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t === "existing" ? "Existente" : "Nuevo cliente"}
            </button>
          ))}
        </div>

        {loadingData ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
        ) : tab === "existing" ? (
          // ── EXISTING CLIENT ────────────────────────────────────────────────
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Selecciona cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.user.name} ({c.user.email})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Entrenador 1 *</label>
              <select value={teacher1} onChange={e => setTeacher1(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Selecciona entrenador...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.user.name}</option>)}
              </select>
            </div>

            {(isAdmin || true) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Entrenador 2 <span className="text-gray-400 font-normal">(opcional)</span></label>
                <select value={teacher2} onChange={e => setTeacher2(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  <option value="">Sin 2º entrenador</option>
                  {teacherOptions(teacher1).map(t => <option key={t.id} value={t.id}>{t.user.name}</option>)}
                </select>
              </div>
            )}

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Máximo 2 entrenadores por cliente.
            </p>

            <Button size="lg" className="w-full" onClick={handleSaveExisting} disabled={loading || !clientId || !teacher1}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Asignar cliente"}
            </Button>
          </div>
        ) : (
          // ── NEW CLIENT ─────────────────────────────────────────────────────
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
              <input
                type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ana García López"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
              <input
                type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="ana@ejemplo.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Entrenador 1 *</label>
              <select value={newTeacher1} onChange={e => setNewTeacher1(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Selecciona entrenador...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.user.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Entrenador 2 <span className="text-gray-400 font-normal">(opcional)</span></label>
              <select value={newTeacher2} onChange={e => setNewTeacher2(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Sin 2º entrenador</option>
                {teacherOptions(newTeacher1).map(t => <option key={t.id} value={t.id}>{t.user.name}</option>)}
              </select>
            </div>

            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3">
              Se creará una cuenta nueva. El cliente puede acceder con su email y establecer su contraseña.
            </p>

            <Button
              size="lg" className="w-full"
              onClick={handleCreateNew}
              disabled={loading || !newName.trim() || !newEmail.trim() || !newTeacher1}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Crear y asignar cliente"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
