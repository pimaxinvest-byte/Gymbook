"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CreditCard, Plus, Minus, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, History,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL";
type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "BIZUM" | "OTHER";
type CreditLogAction =
  | "CREATED" | "MARKED_PAID" | "MARKED_UNPAID" | "PARTIALLY_PAID"
  | "CREDIT_USED" | "CREDIT_RESTORED" | "ADJUSTED" | "CANCELLED";

interface CreditLog {
  id: string;
  actionType: CreditLogAction;
  amount: number | null;
  notes: string | null;
  createdAt: string;
  performedBy: { name: string };
  booking?: { startDatetime: string; activity: { name: string } } | null;
}

interface CreditRecord {
  id: string;
  balance: number;
  totalAssigned: number;
  creditType: "INDIVIDUAL" | "SGT";
  paymentStatus: PaymentStatus;
  amountPaid: number | null;
  paymentMethod: PaymentMethod | null;
  paymentDate: string | null;
  notes: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  updatedAt: string;
  client: { id: string; user: { id: string; name: string; email: string; avatarUrl: string | null } };
  teacher: { id: string; user: { id: string; name: string; email: string } };
  transactions: Array<{
    id: string; amount: number; type: string; note: string | null;
    createdAt: string; createdBy: { name: string };
  }>;
  creditLogs?: CreditLog[];
}

interface Client { id: string; user: { id: string; name: string; email: string } }
interface Teacher { id: string; user: { id: string; name: string; email: string } }

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Pagado", UNPAID: "Sin pagar", PARTIAL: "Parcial",
};
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", BIZUM: "Bizum", OTHER: "Otro",
};

function PaymentBadge({ status, amountPaid }: { status: PaymentStatus; amountPaid: number | null }) {
  if (status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Pagado
      </span>
    );
  }
  if (status === "PARTIAL") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
        <Clock className="h-3 w-3" aria-hidden="true" /> Parcial {amountPaid != null ? `€${amountPaid}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Sin pagar
    </span>
  );
}

function logActionIcon(action: CreditLogAction) {
  switch (action) {
    case "CREDIT_USED": return "🔴";
    case "CREDIT_RESTORED": return "🟢";
    case "CREATED": return "🟡";
    case "MARKED_PAID": return "💚";
    case "MARKED_UNPAID": return "🔴";
    case "PARTIALLY_PAID": return "🟠";
    case "ADJUSTED": return "🔵";
    case "CANCELLED": return "⚫";
    default: return "⚪";
  }
}

function logActionLabel(log: CreditLog): string {
  switch (log.actionType) {
    case "CREDIT_USED":
      return log.booking
        ? `-1 crédito — ${log.booking.activity.name}`
        : "-1 crédito usado";
    case "CREDIT_RESTORED":
      return "+1 crédito restaurado (cancelación)";
    case "CREATED":
      return `+${log.amount ?? 0} créditos asignados`;
    case "MARKED_PAID":
      return `Marcado como pagado${log.amount != null ? ` (€${log.amount})` : ""}`;
    case "MARKED_UNPAID":
      return "Marcado como sin pagar";
    case "PARTIALLY_PAID":
      return `Pago parcial${log.amount != null ? ` (€${log.amount})` : ""}`;
    case "ADJUSTED":
      return `Ajuste: ${(log.amount ?? 0) > 0 ? "+" : ""}${log.amount ?? 0} créditos`;
    case "CANCELLED":
      return "Créditos cancelados";
    default:
      return log.actionType;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CreditsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentDialogRecord, setPaymentDialogRecord] = useState<CreditRecord | null>(null);
  const [logsMap, setLogsMap] = useState<Record<string, CreditLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<Record<string, boolean>>({});

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

  async function loadLogs(id: string) {
    if (logsMap[id] || loadingLogs[id]) return;
    setLoadingLogs((prev) => ({ ...prev, [id]: true }));
    const res = await fetch(`/api/credits/${id}/logs`);
    if (res.ok) {
      const data = await res.json();
      setLogsMap((prev) => ({ ...prev, [id]: data }));
    }
    setLoadingLogs((prev) => ({ ...prev, [id]: false }));
  }

  const isTeacherOrAdmin = role === "TEACHER" || role === "ADMIN";

  // Client summary
  const totalAvailable = credits.reduce((s, c) => s + c.balance, 0);
  const totalAssigned = credits.reduce((s, c) => s + (c.totalAssigned ?? 0), 0);
  const totalUsed = totalAssigned - totalAvailable;

  // Teacher alert: clients with 0 balance
  const zeroBalanceCount = credits.filter((c) => c.balance === 0).length;

  return (
    <AppShell title="Créditos">
      <div className="p-4 max-w-2xl mx-auto">

        {/* Teacher alert */}
        {role === "TEACHER" && zeroBalanceCount > 0 && (
          <div className="mb-4 rounded-2xl bg-orange-50 border border-orange-200 p-3 flex gap-2 items-center">
            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-orange-800 font-medium">
              {zeroBalanceCount} cliente{zeroBalanceCount > 1 ? "s" : ""} sin créditos disponibles
            </p>
          </div>
        )}

        {/* Client summary card */}
        {role === "CLIENT" && credits.length > 0 && (
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white shadow-lg">
            <p className="text-xs font-medium opacity-80 mb-2">Mis Créditos</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black">{totalAvailable}</p>
                <p className="text-xs opacity-80">disponibles</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{totalUsed}</p>
                <p className="text-xs opacity-80">usados</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{totalAssigned}</p>
                <p className="text-xs opacity-80">totales</p>
              </div>
            </div>
            {credits[0]?.expiresAt && (
              <p className="text-xs opacity-70 mt-2">
                Expiran: {new Date(credits[0].expiresAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        )}

        {/* Client info banner */}
        {role === "CLIENT" && (
          <div className="mb-4 rounded-2xl bg-orange-50 border border-orange-100 p-4 flex gap-3 items-start">
            <CreditCard className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-orange-800">¿Cómo funcionan los créditos?</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Cada reserva consume 1 crédito con ese entrenador. Si cancelas a tiempo, el crédito se devuelve automáticamente.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {role === "CLIENT"
              ? "Por entrenador"
              : `${credits.length} registro${credits.length !== 1 ? "s" : ""}`}
          </p>
          {isTeacherOrAdmin && (
            <Button size="sm" onClick={() => setShowAssign(true)}>
              <Plus className="h-4 w-4" /> Asignar créditos
            </Button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3" aria-busy="true">
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
              const logs = logsMap[rec.id] ?? [];

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
                        {/* Payment status */}
                        <div className="mt-1">
                          <PaymentBadge status={rec.paymentStatus} amountPaid={rec.amountPaid} />
                        </div>
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
                            <button
                              onClick={() => setPaymentDialogRecord(rec)}
                              aria-label="Gestionar pago"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
                            >
                              <CreditCard className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                          aria-label={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                          aria-expanded={isExpanded}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"
                        >
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Total asignados: <span className="font-medium text-gray-700">{rec.totalAssigned ?? 0}</span></p>
                          <p>Usados: <span className="font-medium text-gray-700">{(rec.totalAssigned ?? 0) - rec.balance}</span></p>
                          {rec.expiresAt && (
                            <p>
                              Expiran: <span className={`font-medium ${rec.isExpired ? "text-red-600" : "text-gray-700"}`}>
                                {new Date(rec.expiresAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                                {rec.isExpired ? " ⚠ EXPIRADO" : ""}
                              </span>
                            </p>
                          )}
                          {rec.paymentMethod && (
                            <p>Método: <span className="font-medium text-gray-700">{PAYMENT_METHOD_LABELS[rec.paymentMethod]}</span></p>
                          )}
                          {rec.paymentDate && (
                            <p>Fecha pago: <span className="font-medium text-gray-700">{new Date(rec.paymentDate).toLocaleDateString("es-ES")}</span></p>
                          )}
                          {rec.notes && <p className="italic text-gray-400">&ldquo;{rec.notes}&rdquo;</p>}
                          <p>Actualizado: {new Date(rec.updatedAt).toLocaleString("es-ES")}</p>
                          {rec.balance === 0 && (
                            <p className="text-red-500 font-medium">⚠ Sin créditos — el cliente no podrá reservar</p>
                          )}
                        </div>

                        {/* Credit log section */}
                        <div className="pt-2 border-t border-gray-50">
                          <button
                            onClick={() => loadLogs(rec.id)}
                            className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium cursor-pointer"
                          >
                            <History className="h-3.5 w-3.5" aria-hidden="true" />
                            {loadingLogs[rec.id] ? "Cargando..." : "Ver historial de movimientos"}
                          </button>
                          {logs.length > 0 && (
                            <ul className="mt-2 space-y-1.5">
                              {logs.map((log) => (
                                <li key={log.id} className="flex gap-2 text-xs text-gray-500">
                                  <span className="flex-shrink-0 text-sm" aria-hidden="true">{logActionIcon(log.actionType)}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-gray-700">{logActionLabel(log)}</p>
                                    <p className="text-gray-400 text-[10px]">
                                      {new Date(log.createdAt).toLocaleString("es-ES")} · {log.performedBy.name}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Credits Modal */}
      {showAssign && (
        <AssignCreditsModal
          onClose={() => setShowAssign(false)}
          onSaved={() => { setShowAssign(false); load(); }}
          isAdmin={role === "ADMIN"}
        />
      )}

      {/* Payment Dialog */}
      {paymentDialogRecord && (
        <PaymentDialog
          record={paymentDialogRecord}
          onClose={() => setPaymentDialogRecord(null)}
          onSaved={() => { setPaymentDialogRecord(null); load(); }}
        />
      )}
    </AppShell>
  );
}

// ── Payment Dialog ────────────────────────────────────────────────────────────

function PaymentDialog({
  record,
  onClose,
  onSaved,
}: {
  record: CreditRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(record.paymentStatus);
  const [amountPaid, setAmountPaid] = useState(record.amountPaid?.toString() ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(record.paymentMethod ?? "");
  const [paymentDate, setPaymentDate] = useState(
    record.paymentDate ? record.paymentDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(record.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (paymentStatus === "PAID" && !amountPaid) {
      toast({ title: "Introduce el importe pagado", variant: "error" });
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/credits/${record.id}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentStatus,
        amountPaid: amountPaid ? parseFloat(amountPaid) : undefined,
        paymentMethod: paymentMethod || undefined,
        paymentDate: paymentDate || undefined,
        notes: notes || undefined,
      }),
    });
    if (res.ok) {
      toast({ title: "Pago actualizado ✓", variant: "success" });
      onSaved();
    } else {
      const data = await res.json();
      toast({ title: data.error || "Error al actualizar pago", variant: "error" });
    }
    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>Gestionar pago</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-2">
          {record.client.user.name} · {record.totalAssigned ?? 0} créditos totales
        </p>

        <div className="space-y-4 mt-2">
          {/* Payment status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="pay-status">
              Estado de pago *
            </label>
            <select
              id="pay-status"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
            >
              {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          {(paymentStatus === "PAID" || paymentStatus === "PARTIAL") && (
            <Input
              label={`Importe ${paymentStatus === "PAID" ? "pagado" : "parcial"} (€) *`}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          )}

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="pay-method">
              Método de pago
            </label>
            <select
              id="pay-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
              className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
            >
              <option value="">— Sin especificar —</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <Input
            label="Fecha de pago"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="pay-notes">
              Notas internas
            </label>
            <textarea
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional..."
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-400 resize-none"
            />
          </div>

          <Button size="lg" className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Credits Modal ──────────────────────────────────────────────────────

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
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("UNPAID");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [clientsRes, teachersRes] = await Promise.all([
        fetch("/api/clients"),
        isAdmin ? fetch("/api/teachers") : Promise.resolve(null),
      ]);
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (teachersRes?.ok) setTeachers(await teachersRes.json());
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
        paymentStatus,
        amountPaid: amountPaid ? parseFloat(amountPaid) : undefined,
        paymentMethod: paymentMethod || undefined,
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
                  <option key={c.id} value={c.id}>{c.user.name} ({c.user.email})</option>
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
                    <option key={t.id} value={t.id}>{t.user.name}</option>
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

            {/* Payment status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="assign-pay-status">
                Estado de pago
              </label>
              <select
                id="assign-pay-status"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
              >
                {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Amount paid (if paid or partial) */}
            {(paymentStatus === "PAID" || paymentStatus === "PARTIAL") && (
              <>
                <Input
                  label="Importe (€)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="assign-pay-method">
                    Método de pago
                  </label>
                  <select
                    id="assign-pay-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
                    className="w-full h-12 rounded-xl border-2 border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white cursor-pointer"
                  >
                    <option value="">— Sin especificar —</option>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

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
