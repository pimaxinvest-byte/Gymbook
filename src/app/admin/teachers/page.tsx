"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, X, MessageCircle, Copy, Check, Send } from "lucide-react";
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
          <div className="flex gap-2">
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
