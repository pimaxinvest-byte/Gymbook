"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, User } from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";

interface Teacher { id: string; color: string; bio?: string; user: { id: string; name: string; email: string; telegramChatId?: string } }

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);

  async function load() {
    const r = await fetch("/api/teachers");
    setTeachers(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este profesor?")) return;
    await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    toast({ title: "Profesor eliminado", variant: "success" });
    load();
  }

  return (
    <AppShell title="Profesores">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{teachers.length} profesores</p>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Añadir
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3" aria-label="Cargando profesores..." aria-busy="true">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="space-y-3">
            {teachers.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: t.color }}>
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{t.user.email}</p>
                    {t.user.telegramChatId && (
                      <p className="text-xs text-blue-500 truncate">📱 Telegram activo</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditTeacher(t)}
                      aria-label={`Editar ${t.user.name}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      aria-label={`Eliminar ${t.user.name}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && <TeacherFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editTeacher && <TeacherFormModal teacher={editTeacher} onClose={() => setEditTeacher(null)} onSaved={() => { setEditTeacher(null); load(); }} />}
    </AppShell>
  );
}

function TeacherFormModal({ teacher, onClose, onSaved }: { teacher?: Teacher; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!teacher;
  const [form, setForm] = useState({
    name: teacher?.user.name || "",
    email: teacher?.user.email || "",
    password: "",
    color: teacher?.color || "#6366f1",
    bio: teacher?.bio || "",
    telegramChatId: teacher?.user.telegramChatId || "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const url = isEdit ? `/api/teachers/${teacher!.id}` : "/api/teachers";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
          {!isEdit && <Input label="Contraseña *" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color en calendario</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-10 w-16 rounded-xl border-2 border-gray-200 cursor-pointer" />
              <span className="text-sm text-gray-600">{form.color}</span>
            </div>
          </div>
          <Input label="Telegram Chat ID" value={form.telegramChatId} placeholder="Ej: 123456789" onChange={(e) => setForm((f) => ({ ...f, telegramChatId: e.target.value }))} />
          <Input label="Bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          <Button size="lg" className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isEdit ? "Guardar cambios" : "Crear profesor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
