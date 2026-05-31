"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Plus, Minus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface CreditRecord {
  id: string;
  balance: number;
  client: { id: string; user: { id: string; name: string; email: string } };
  teacher: { id: string; user: { id: string; name: string; email: string } };
  updatedAt: string;
}

interface Client {
  id: string;
  user: { id: string; name: string; email: string };
}

interface Teacher {
  id: string;
  user: { id: string; name: string; email: string };
}

export default function CreditsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/credits");
    if (res.ok) setCredits(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function adjustCredits(record: CreditRecord, delta: number) {
    const res = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: record.client.id,
        teacherId: record.teacher.id,
        amount: delta,
        note: delta > 0 ? "Crédito añadido manualmente" : "Crédito descontado manualmente",
      }),
    });
    if (res.ok) {
      toast({ title: delta > 0 ? "Crédito añadido ✓" : "Crédito descontado ✓", variant: "success" });
      load();
    } else {
      const data = await res.json();
      toast({ title: data.error || "Error", variant: "error" });
    }
  }

  const isTeacherOrAdmin = role === "TEACHER" || role === "ADMIN";

  return (
    <AppShell title="Créditos">
      <div className="p-4 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {role === "CLIENT"
              ? "Tus créditos por entrenador"
              : `${credits.length} registro${credits.length !== 1 ? "s" : ""}`}
          </p>
          {isTeacherOrAdmin && (
            <Button size="sm" onClick={() => setShowAssign(true)}>
              <Plus className="h-4 w-4" /> Asignar créditos
            </Button>
          )}
        </div>

        {/* Info banner for clients */}
        {role === "CLIENT" && (
          <div className="mb-4 rounded-2xl bg-orange-50 border border-orange-100 p-4 flex gap-3 items-start">
            <CreditCard className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-orange-800">¿Cómo funcionan los créditos?</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Cada reserva de entrenamiento personal consume 1 crédito con ese entrenador. Si cancelas, el crédito se devuelve automáticamente.
              </p>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando créditos...">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : credits.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p className="font-medium">Sin créditos asignados</p>
            {isTeacherOrAdmin && (
              <p className="text-sm mt-1">Pulsa «Asignar créditos» para comenzar</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {credits.map((rec) => {
              const isExpanded = expandedId === rec.id;
              const balanceColor =
                rec.balance === 0
                  ? "bg-red-100 text-red-700"
                  : rec.balance <= 2
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700";

              return (
                <Card key={rec.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Balance badge */}
                      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${balanceColor}`}>
                        <span className="text-2xl font-black leading-none">{rec.balance}</span>
                        <span className="text-[10px] font-medium leading-none mt-0.5">créditos</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {role !== "CLIENT" && (
                          <p className="font-semibold text-gray-900 truncate">{rec.client.user.name}</p>
                        )}
                        <p className="text-xs text-gray-500 truncate">
                          {role === "CLIENT" ? `Entrenador: ${rec.teacher.user.name}` : rec.client.user.email}
                        </p>
                        {role === "ADMIN" && (
                          <p className="text-xs text-gray-400 truncate">Entrenador: {rec.teacher.user.name}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isTeacherOrAdmin && (
                          <>
                            <button
                              onClick={() => adjustCredits(rec, -1)}
                              disabled={rec.balance === 0}
                              aria-label="Quitar 1 crédito"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => adjustCredits(rec, 1)}
                              aria-label="Añadir 1 crédito"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-green-50 text-gray-400 hover:text-green-500 transition-colors cursor-pointer"
                            >
                              <Plus className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                          aria-label={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                          aria-expanded={isExpanded}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                        <p>Última actualización: {new Date(rec.updatedAt).toLocaleString("es-ES")}</p>
                        {role !== "CLIENT" && <p>Email cliente: {rec.client.user.email}</p>}
                        <p>Entrenador: {rec.teacher.user.name} ({rec.teacher.user.email})</p>
                        {rec.balance === 0 && (
                          <p className="text-red-500 font-medium">⚠ Sin créditos — el cliente no podrá reservar</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showAssign && (
        <AssignCreditsModal
          onClose={() => setShowAssign(false)}
          onSaved={() => { setShowAssign(false); load(); }}
          isAdmin={role === "ADMIN"}
        />
      )}
    </AppShell>
  );
}

// ── Assign Credits Modal ─────────────────────────────────────────────────────

function AssignCreditsModal({
  onClose,
  onSaved,
  isAdmin,
}: {
  onClose: () => void;
  onSaved: () => void;
  isAdmin: boolean;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [clientId, setClientId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [cr, tr] = await Promise.all([
        fetch("/api/auth/register?role=CLIENT").then(() => fetch("/api/clients")).catch(() => null),
        isAdmin ? fetch("/api/teachers") : Promise.resolve(null),
      ]);

      // Fetch clients list
      const clientsRes = await fetch("/api/clients");
      if (clientsRes.ok) setClients(await clientsRes.json());

      // Fetch teachers (admin only)
      if (isAdmin) {
        const teachersRes = await fetch("/api/teachers");
        if (teachersRes.ok) setTeachers(await teachersRes.json());
      }

      // Suppress unused warning
      void cr; void tr;
      setLoadingData(false);
    }
    loadData();
  }, [isAdmin]);

  async function handleSave() {
    const amt = parseInt(amount, 10);
    if (!clientId || isNaN(amt) || amt <= 0) {
      toast({ title: "Selecciona un cliente y cantidad válida", variant: "error" });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        teacherId: isAdmin ? teacherId || undefined : undefined,
        amount: amt,
        note: note || `${amt} crédito${amt !== 1 ? "s" : ""} asignado${amt !== 1 ? "s" : ""}`,
      }),
    });
    if (res.ok) {
      toast({ title: `${amt} crédito${amt !== 1 ? "s" : ""} asignado${amt !== 1 ? "s" : ""} ✓`, variant: "success" });
      onSaved();
    } else {
      const data = await res.json();
      toast({ title: data.error || "Error al asignar", variant: "error" });
    }
    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>Asignar créditos</DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Client selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="credit-client">
                Cliente *
              </label>
              <select
                id="credit-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
              >
                <option value="">Selecciona un cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.user.name} ({c.user.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Teacher selector (admin only) */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="credit-teacher">
                  Entrenador *
                </label>
                <select
                  id="credit-teacher"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
                >
                  <option value="">Selecciona un entrenador...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount */}
            <Input
              label="Créditos a asignar *"
              type="number"
              min="1"
              max="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            {/* Note */}
            <Input
              label="Nota (opcional)"
              placeholder="Ej: Bono mensual"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <Button size="lg" className="w-full" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Asignar créditos"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
