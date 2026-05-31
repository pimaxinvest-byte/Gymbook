"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, X, MessageCircle, Copy, Check, Send, UserPlus, Mail, ExternalLink, RefreshCw, KeyRound } from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toaster";

interface Activity { id: string; name: string; color?: string }
interface Teacher {
  id: string;
  color: string;
  bio?: string;
  user: { id: string; name: string; email: string; telegramChatId?: string | null; telegramConnected: boolean; telegramUsername?: string | null; avatarUrl?: string | null };
  teacherActivities: { activity: Activity }[];
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [inviteLink, setInviteLink] = useState<{ name: string; url: string } | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [showClientInvite, setShowClientInvite] = useState(false);
  const [harbizTeacher, setHarbizTeacher] = useState<Teacher | null>(null); // teacher whose Harbiz dialog is open

  async function load() {
    const [tr, ar] = await Promise.all([
      fetch("/api/teachers").then((r) => r.json()),
      fetch("/api/activities").then((r) => r.json()),
    ]);
    setTeachers(tr);
    setAllActivities(ar);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este profesor?")) return;
    await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    toast({ title: "Profesor eliminado", variant: "success" });
    load();
  }

  async function generateInviteLink(userId: string, userName: string) {
    const r = await fetch("/api/telegram/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (r.ok) {
      const { url } = await r.json();
      setInviteLink({ name: userName, url });
    } else {
      toast({ title: "Error: configura el bot de Telegram primero", variant: "error" });
    }
  }

  async function broadcastPDF() {
    setBroadcasting(true);
    const r = await fetch("/api/admin/telegram/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "pdf" }),
    });
    const d = await r.json();
    if (r.ok) {
      const parts = [];
      if (d.sent?.length)    parts.push(`✓ Enviado a: ${d.sent.join(", ")}`);
      if (d.pending?.length) parts.push(`⏳ Sin Telegram: ${d.pending.join(", ")}`);
      if (d.errors?.length)  parts.push(`✗ Error: ${d.errors.join(", ")}`);
      toast({ title: parts.join(" | ") || "Sin cambios", variant: d.sent?.length ? "success" : "error" });
    } else {
      toast({ title: d.error || "Error", variant: "error" });
    }
    setBroadcasting(false);
  }

  async function removeActivity(teacherId: string, activityId: string) {
    await fetch(`/api/teachers/${teacherId}/activities?activityId=${activityId}`, { method: "DELETE" });
    toast({ title: "Actividad eliminada", variant: "success" });
    load();
  }

  async function addActivity(teacherId: string, activityId: string) {
    const r = await fetch(`/api/teachers/${teacherId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId }),
    });
    if (r.ok) { toast({ title: "Actividad asignada", variant: "success" }); load(); }
    else { const d = await r.json(); toast({ title: d.error || "Error", variant: "error" }); }
  }

  return (
    <AppShell title="Profesores">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{teachers.length} profesores</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setShowClientInvite(true)}>
              <UserPlus className="h-4 w-4" /> Invitar clientes
            </Button>
            <Button size="sm" variant="outline" onClick={broadcastPDF} disabled={broadcasting}>
              {broadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar PDF
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Añadir
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3" aria-label="Cargando profesores..." aria-busy="true">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="space-y-4">
            {teachers.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={t.user.name}
                      avatarUrl={t.user.avatarUrl}
                      telegramChatId={t.user.telegramChatId}
                      size="md"
                      editable
                      userId={t.user.id}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{t.user.name}</p>
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      </div>
                      <p className="text-xs text-gray-500 truncate">{t.user.email}</p>
                      {/* Telegram status */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.user.telegramConnected ? "bg-blue-500" : "bg-gray-300"}`} />
                        <span className={`text-xs font-medium ${t.user.telegramConnected ? "text-blue-600" : "text-gray-400"}`}>
                          {t.user.telegramConnected ? `Telegram: ${t.user.telegramUsername || "conectado"}` : "Telegram sin conectar"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => generateInviteLink(t.user.id, t.user.name)}
                        aria-label="Generar enlace Telegram"
                        title={t.user.telegramConnected ? "Reconectar Telegram" : "Generar enlace de conexión Telegram"}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                          t.user.telegramConnected
                            ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                            : "bg-blue-50 text-blue-400 hover:bg-blue-100"
                        }`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setHarbizTeacher(t)}
                        aria-label={`Importar desde Harbiz para ${t.user.name}`}
                        title="Importar desde Harbiz"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-100 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditTeacher(t)}
                        aria-label={`Editar ${t.user.name}`}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        aria-label={`Eliminar ${t.user.name}`}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Activities section */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actividades</p>
                    <div className="flex flex-wrap gap-2">
                      {t.teacherActivities.map((ta) => (
                        <span
                          key={ta.activity.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: ta.activity.color || "#6b7280" }}
                        >
                          {ta.activity.name}
                          <button
                            onClick={() => removeActivity(t.id, ta.activity.id)}
                            aria-label={`Quitar ${ta.activity.name}`}
                            className="hover:opacity-70 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}

                      {/* Add activity dropdown */}
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) addActivity(t.id, e.target.value);
                          e.target.value = "";
                        }}
                        className="h-7 px-2 rounded-full border-2 border-dashed border-gray-300 bg-white text-xs text-gray-500 focus:border-orange-400 focus:outline-none cursor-pointer"
                        aria-label="Añadir actividad"
                      >
                        <option value="">+ Actividad</option>
                        {allActivities
                          .filter((a) => !t.teacherActivities.some((ta) => ta.activity.id === a.id))
                          .map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {t.bio && <p className="text-xs text-gray-400 italic">{t.bio}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && <TeacherFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editTeacher && <TeacherFormModal teacher={editTeacher} onClose={() => setEditTeacher(null)} onSaved={() => { setEditTeacher(null); load(); }} />}
      {inviteLink && <InviteLinkModal name={inviteLink.name} url={inviteLink.url} onClose={() => setInviteLink(null)} />}
      {showClientInvite && <ClientInviteModal onClose={() => setShowClientInvite(false)} />}
      {harbizTeacher && <HarbizModal teacher={harbizTeacher} onClose={() => setHarbizTeacher(null)} />}
    </AppShell>
  );
}

// ── Invite Link Modal ─────────────────────────────────────────────────────────
function InviteLinkModal({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>Enlace de Telegram para {name.split(" ")[0]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs text-blue-700 font-medium mb-2">
              Comparte este enlace con {name.split(" ")[0]}. Al abrirlo y pulsar /start en el bot, su Telegram quedará vinculado automáticamente.
            </p>
            <p className="text-xs font-mono break-all text-blue-900 bg-white/70 rounded-lg p-2 select-all">{url}</p>
          </div>

          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={copyLink}>
              {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar enlace</>}
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.open(url, "_blank")}>
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            El enlace expira en 24 h. Genera uno nuevo si es necesario.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Client Invite Modal ───────────────────────────────────────────────────────
const REGISTER_URL = "https://gymbook-app-production.up.railway.app/register";
const DEFAULT_INVITE_MSG = `¡Hola! Te invitamos a unirte a GymBook, la app de reservas de nuestro gimnasio.\n\nReserva sesiones con tu entrenador personal, gestiona tus créditos y horarios, y recibe notificaciones en Telegram.\n\nRegístrate aquí: ${REGISTER_URL}\n\n¡Te esperamos!`;

function ClientInviteModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState(DEFAULT_INVITE_MSG);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(REGISTER_URL).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  }

  function copyMessage() {
    navigator.clipboard.writeText(message).then(() => {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    });
  }

  const encodedMessage = encodeURIComponent(message);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-orange-500" />
            Invitar nuevos clientes
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Link */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Enlace de registro</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 break-all">
                {REGISTER_URL}
              </p>
              <button
                onClick={copyLink}
                aria-label="Copiar enlace"
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {/* Message */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mensaje</p>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-orange-400 resize-none text-gray-700 leading-relaxed"
            />
          </div>
          {/* Share buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`mailto:?subject=${encodeURIComponent("Invitación GymBook")}&body=${encodedMessage}`}
              className="flex items-center justify-center gap-1.5 h-10 rounded-xl border-2 border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-600 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
            <a
              href={`https://wa.me/?text=${encodedMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 h-10 rounded-xl border-2 border-green-200 bg-green-50 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              WhatsApp
            </a>
            <Button size="sm" variant="outline" onClick={copyMessage} className="col-span-2">
              {copiedMsg ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar texto</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Harbiz Modal ──────────────────────────────────────────────────────────────
function HarbizModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const firstName = teacher.user.name.split(" ")[0];

  // Credentials form
  const [harbizEmail, setHarbizEmail] = useState("");
  const [harbizPassword, setHarbizPassword] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);
  const [phase, setPhase] = useState<"idle" | "preview" | "confirm">("idle");

  // Load existing connection on mount
  useEffect(() => {
    fetch(`/api/harbiz/connection?teacherId=${teacher.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.configured && d.harbizEmail) {
          setHarbizEmail(d.harbizEmail);
          setCredsSaved(true);
        }
      })
      .catch(() => {/* ignore */});
  }, [teacher.id]);

  async function saveCredentials() {
    if (!harbizEmail) { toast({ title: "Email de Harbiz requerido", variant: "error" }); return; }
    setSavingCreds(true);
    const r = await fetch("/api/harbiz/connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: teacher.id, harbizEmail, harbizPassword: harbizPassword || undefined }),
    });
    if (r.ok) {
      toast({ title: "Credenciales guardadas", variant: "success" });
      setCredsSaved(true);
      setHarbizPassword(""); // clear password field after save
    } else {
      const d = await r.json();
      toast({ title: d.error || "Error guardando credenciales", variant: "error" });
    }
    setSavingCreds(false);
  }

  async function runSync(dryRun: boolean) {
    setSyncing(true);
    setSyncResult(null);
    const r = await fetch(`/api/harbiz/sync?dryRun=${dryRun}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: teacher.id }),
    });
    const data = await r.json();
    setSyncing(false);
    if (!r.ok) {
      toast({ title: data.error || "Error en la sincronización", variant: "error" });
      return;
    }
    setSyncResult(data);
    setPhase(dryRun ? "preview" : "confirm");
    if (!dryRun) {
      toast({ title: "Sincronización completada", variant: "success" });
    }
  }

  const result = syncResult as {
    dryRun?: boolean;
    status?: string;
    clients?: { found: number; toCreate: number; toUpdate: number; skipped: number };
    sessions?: { found: number; toCreate: number; skipped: number };
    packs?: { found: number; toCreate: number };
    errors?: string[];
    diff?: Array<{ entity: string; action: string; harbizId: string; label: string }>;
  } | null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-500" />
            Importar desde Harbiz — {firstName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Credentials section */}
          <div className="rounded-xl border-2 border-dashed border-orange-200 bg-orange-50 p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-orange-600" />
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Credenciales Harbiz</p>
            </div>
            <Input
              label="Email de Harbiz"
              type="email"
              value={harbizEmail}
              onChange={(e) => { setHarbizEmail(e.target.value); setCredsSaved(false); }}
              placeholder="email@ejemplo.com"
            />
            <Input
              label={credsSaved ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña de Harbiz"}
              type="password"
              value={harbizPassword}
              onChange={(e) => { setHarbizPassword(e.target.value); setCredsSaved(false); }}
              placeholder={credsSaved ? "••••••••" : "Contraseña de tu cuenta Harbiz"}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={saveCredentials}
              disabled={savingCreds || !harbizEmail}
            >
              {savingCreds ? <Loader2 className="h-4 w-4 animate-spin" /> : credsSaved ? <><Check className="h-4 w-4" /> Actualizar credenciales</> : "Guardar credenciales"}
            </Button>
            {credsSaved && (
              <p className="text-xs text-orange-600 text-center">
                ✓ Credenciales guardadas (contraseña cifrada)
              </p>
            )}
          </div>

          {/* Sync actions */}
          {phase === "idle" && (
            <div className="space-y-2">
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => runSync(true)}
                disabled={syncing}
              >
                {syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando...</> : <><RefreshCw className="h-4 w-4" /> Previsualizar importación</>}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                Previsualización: sin cambios en la base de datos
              </p>
            </div>
          )}

          {/* Dry-run preview */}
          {phase === "preview" && result && (
            <div className="space-y-3">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-700">{result.clients?.toCreate ?? 0}</p>
                  <p className="text-xs text-blue-500">Clientes nuevos</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-700">{result.sessions?.toCreate ?? 0}</p>
                  <p className="text-xs text-blue-500">Sesiones</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-700">{result.packs?.toCreate ?? 0}</p>
                  <p className="text-xs text-blue-500">Bonos</p>
                </div>
              </div>

              {(result.diff?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <p className="text-xs font-semibold text-gray-500 px-3 py-2 bg-gray-50 uppercase tracking-wide">
                    Cambios ({result.diff!.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {result.diff!.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className={`w-16 font-mono text-center rounded px-1 py-0.5 ${
                          item.action === "CREATE" ? "bg-green-100 text-green-700" :
                          item.action === "UPDATE" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>{item.action}</span>
                        <span className="text-gray-400 w-14">{item.entity}</span>
                        <span className="text-gray-600 truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(result.errors?.length ?? 0) > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Advertencias ({result.errors!.length})</p>
                  {result.errors!.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                  {result.errors!.length > 3 && <p className="text-xs text-red-400">+{result.errors!.length - 3} más</p>}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSyncResult(null); setPhase("idle"); }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => {
                    if (!confirm(`¿Confirmar importación real para ${firstName}? Se crearán ${result.clients?.toCreate ?? 0} clientes, ${result.sessions?.toCreate ?? 0} sesiones y ${result.packs?.toCreate ?? 0} bonos.`)) return;
                    setPhase("idle");
                    runSync(false);
                  }}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importar ahora"}
                </Button>
              </div>
            </div>
          )}

          {/* Completed */}
          {phase === "confirm" && result && (
            <div className="space-y-3">
              <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.clients?.toCreate ?? 0}</p>
                <p className="text-xs text-green-600">clientes importados</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-2">
                  <p className="text-lg font-bold text-gray-700">{result.sessions?.toCreate ?? 0}</p>
                  <p className="text-xs text-gray-500">sesiones</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-2">
                  <p className="text-lg font-bold text-gray-700">{result.packs?.toCreate ?? 0}</p>
                  <p className="text-xs text-gray-500">bonos</p>
                </div>
              </div>
              <Button size="lg" className="w-full" onClick={onClose}>Cerrar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Teacher Form Modal ────────────────────────────────────────────────────────
function TeacherFormModal({ teacher, onClose, onSaved }: { teacher?: Teacher; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!teacher;
  const [form, setForm] = useState({
    name:     teacher?.user.name || "",
    email:    teacher?.user.email || "",
    password: "",
    color:    teacher?.color || "#2563eb",
    bio:      teacher?.bio || "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!form.name || !form.email) {
      toast({ title: "Nombre y email son obligatorios", variant: "error" });
      return;
    }
    if (!isEdit && !form.password) {
      toast({ title: "La contraseña es obligatoria", variant: "error" });
      return;
    }

    setLoading(true);
    const body: Record<string, unknown> = { name: form.name, email: form.email, color: form.color, bio: form.bio };
    if (!isEdit || form.password) body.password = form.password;

    const url = isEdit ? `/api/teachers/${teacher!.id}` : "/api/teachers";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast({ title: isEdit ? "Profesor actualizado" : "Profesor creado", variant: "success" });
      onSaved();
    } else {
      const data = await res.json();
      toast({ title: data.error || "Error", variant: "error" });
    }
    setLoading(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar profesor" : "Nuevo profesor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input label="Nombre *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input
            label={isEdit ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder={isEdit ? "••••••••" : "Mínimo 6 caracteres"}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color en calendario</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-10 w-16 rounded-xl border-2 border-gray-200 cursor-pointer"
              />
              <span className="text-sm text-gray-600">{form.color}</span>
            </div>
          </div>
          <Input label="Bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          <Button size="lg" className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isEdit ? "Guardar cambios" : "Crear profesor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
