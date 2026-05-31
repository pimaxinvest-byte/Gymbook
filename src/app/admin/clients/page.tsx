"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { Avatar } from "@/components/ui/avatar";
import {
  Users, Check, X, Clock, Search, Filter,
  Phone, MessageCircle, User, ChevronDown, ChevronUp,
} from "lucide-react";

interface ClientRecord {
  id: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  phone?: string | null;
  goals?: string | null;
  notes?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    telegramConnected: boolean;
    telegramUsername?: string | null;
    telegramPhone?: string | null;
    avatarUrl?: string | null;
  };
  clientTeachers: { teacher: { user: { name: string } } }[];
  preferredActivity?: { name: string } | null;
  _count: { bookings: number; sgtParticipations: number };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   "Pendiente",
  ACTIVE:    "Activo",
  REJECTED:  "Rechazado",
  SUSPENDED: "Suspendido",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700 border-amber-200",
  ACTIVE:    "bg-green-100 text-green-700 border-green-200",
  REJECTED:  "bg-red-100 text-red-600 border-red-200",
  SUSPENDED: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterTelegram, setFilterTelegram] = useState<string>("");
  const [search, setSearch] = useState("");
  const [detailClient, setDetailClient] = useState<ClientRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus)   params.set("status",   filterStatus);
    if (filterTelegram) params.set("telegram",  filterTelegram);
    const r = await fetch(`/api/admin/clients?${params}`);
    if (r.ok) setClients(await r.json());
    setLoading(false);
  }, [filterStatus, filterTelegram]);

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter((c) =>
    !search ||
    c.user.name.toLowerCase().includes(search.toLowerCase()) ||
    c.user.email.toLowerCase().includes(search.toLowerCase())
  );

  const pending = clients.filter((c) => c.status === "PENDING").length;

  async function approve(id: string) {
    const r = await fetch(`/api/admin/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    if (r.ok) { toast({ title: "Cliente activado", variant: "success" }); load(); setDetailClient(null); }
    else toast({ title: "Error", variant: "error" });
  }

  async function reject(id: string, reason?: string) {
    const r = await fetch(`/api/admin/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED", rejectedReason: reason || "Rechazado por el administrador" }),
    });
    if (r.ok) { toast({ title: "Cliente rechazado", variant: "success" }); load(); setDetailClient(null); }
    else toast({ title: "Error", variant: "error" });
  }

  return (
    <AppShell title="Clientes">
      <div className="p-4 max-w-2xl mx-auto">

        {/* Header stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Total",     value: clients.length,                                         color: "bg-gray-50 border-gray-200" },
            { label: "Activos",   value: clients.filter((c) => c.status === "ACTIVE").length,    color: "bg-green-50 border-green-200" },
            { label: "Pendientes",value: pending,                                                 color: pending > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.color}`}>
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter toggle */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-4 rounded-xl border-2 border-gray-200 bg-white text-sm text-gray-900 focus:border-orange-400 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="h-11 px-3 rounded-xl border-2 border-gray-200 bg-white flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendientes</option>
                <option value="ACTIVE">Activos</option>
                <option value="REJECTED">Rechazados</option>
                <option value="SUSPENDED">Suspendidos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telegram</label>
              <select
                value={filterTelegram}
                onChange={(e) => setFilterTelegram(e.target.value)}
                className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="connected">Conectado</option>
                <option value="pending">Sin conectar</option>
              </select>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No hay clientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <Card
                key={c.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setDetailClient(c)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar
                    name={c.user.name}
                    avatarUrl={c.user.avatarUrl}
                    telegramChatId={c.user.telegramConnected ? "connected" : null}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 text-sm truncate">{c.user.name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.user.email}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {c.clientTeachers.length > 0 && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {c.clientTeachers.map((ct) => ct.teacher.user.name).join(", ")}
                        </span>
                      )}
                      {c.user.telegramConnected && (
                        <span className="text-xs text-blue-500 flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> Telegram
                        </span>
                      )}
                      {c._count.bookings > 0 && (
                        <span className="text-xs text-gray-400">{c._count.bookings} reservas</span>
                      )}
                    </div>
                  </div>

                  {/* Quick action for pending */}
                  {c.status === "PENDING" && (
                    <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => approve(c.id)}
                        aria-label="Aprobar cliente"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => reject(c.id)}
                        aria-label="Rechazar cliente"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Client detail modal */}
      {detailClient && (
        <ClientDetailModal
          client={detailClient}
          onClose={() => setDetailClient(null)}
          onApprove={() => approve(detailClient.id)}
          onReject={(r) => reject(detailClient.id, r)}
          onRefresh={load}
        />
      )}
    </AppShell>
  );
}

function ClientDetailModal({
  client,
  onClose,
  onApprove,
  onReject,
  onRefresh,
}: {
  client: ClientRecord;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onRefresh: () => void;
}) {
  const [notes, setNotes] = useState(client.notes || "");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    toast({ title: "Notas guardadas", variant: "success" });
    setSaving(false);
    onRefresh();
  }

  async function sendTelegramLink() {
    const r = await fetch("/api/telegram/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: client.user.id }),
    });
    if (r.ok) {
      const { url } = await r.json();
      window.open(url, "_blank");
      toast({ title: "Enlace de Telegram generado", variant: "success" });
    } else {
      toast({ title: "Error generando enlace", variant: "error" });
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ficha de cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Avatar name={client.user.name} avatarUrl={client.user.avatarUrl} size="lg" />
            <div>
              <p className="font-bold text-gray-900">{client.user.name}</p>
              <p className="text-sm text-gray-500">{client.user.email}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[client.status]}`}>
                {STATUS_LABELS[client.status]}
              </span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {client.phone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-3.5 w-3.5 text-gray-400" />
                {client.phone}
              </div>
            )}
            {client.user.telegramUsername && (
              <div className="flex items-center gap-2 text-gray-600">
                <MessageCircle className="h-3.5 w-3.5 text-gray-400" />
                {client.user.telegramUsername}
              </div>
            )}
            {client.user.telegramPhone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-3.5 w-3.5 text-gray-400" />
                {client.user.telegramPhone}
              </div>
            )}
            {client.clientTeachers.length > 0 && (
              <div className="col-span-2 text-gray-600">
                <span className="font-medium">Profesores:</span>{" "}
                {client.clientTeachers.map((ct) => ct.teacher.user.name).join(", ")}
              </div>
            )}
            {client.goals && (
              <div className="col-span-2 text-gray-600">
                <span className="font-medium">Objetivo:</span> {client.goals}
              </div>
            )}
            <div className="col-span-2 text-gray-500 text-xs">
              Alta: {new Date(client.createdAt).toLocaleDateString("es-ES")}
              {" · "}{client._count.bookings} reservas
            </div>
          </div>

          {/* Telegram status */}
          <div className={`rounded-xl p-3 border ${client.user.telegramConnected ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${client.user.telegramConnected ? "bg-blue-500" : "bg-gray-300"}`} />
                <span className="text-sm font-medium text-gray-700">
                  Telegram {client.user.telegramConnected ? "conectado" : "no conectado"}
                </span>
              </div>
              <button
                onClick={sendTelegramLink}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white rounded-lg px-3 py-1.5 border border-blue-200 hover:border-blue-300 transition-colors cursor-pointer"
              >
                {client.user.telegramConnected ? "Reenviar enlace" : "Conectar"}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas admin</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-orange-400 focus:outline-none resize-none"
              placeholder="Notas internas..."
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              {saving ? "Guardando…" : "Guardar notas"}
            </button>
          </div>

          {/* Actions */}
          {client.status === "PENDING" && (
            <div className="space-y-2">
              <Button size="lg" className="w-full !bg-green-500 hover:!bg-green-600" onClick={onApprove}>
                <Check className="h-4 w-4" /> Aprobar cliente
              </Button>
              {!showRejectForm ? (
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Rechazar
                </button>
              ) : (
                <div className="space-y-2">
                  <Input
                    label="Motivo del rechazo"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Opcional..."
                  />
                  <Button size="lg" className="w-full !bg-red-500 hover:!bg-red-600" onClick={() => onReject(rejectReason)}>
                    <X className="h-4 w-4" /> Confirmar rechazo
                  </Button>
                </div>
              )}
            </div>
          )}

          {client.status === "ACTIVE" && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await fetch(`/api/admin/clients/${client.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "SUSPENDED" }),
                  });
                  toast({ title: "Cliente suspendido", variant: "success" });
                  onClose();
                  onRefresh();
                }}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Suspender
              </button>
            </div>
          )}

          {(client.status === "REJECTED" || client.status === "SUSPENDED") && (
            <Button size="lg" className="w-full" onClick={onApprove}>
              <Check className="h-4 w-4" /> Reactivar cliente
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Using Clock as a fallback (unused import guard)
void Clock;
