"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, Dumbbell } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Activity { id: string; name: string; description?: string; defaultDuration: number; maxCapacity: number; color?: string }

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Activity | null>(null);

  async function load() {
    const r = await fetch("/api/activities");
    setActivities(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar esta actividad?")) return;
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    toast({ title: "Actividad desactivada", variant: "success" });
    load();
  }

  return (
    <AppShell title="Actividades">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{activities.length} actividades</p>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Añadir</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: a.color || "#e0e7ff" }}>
                    <Dumbbell className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.defaultDuration} min · Máx. {a.maxCapacity} personas</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditItem(a)} aria-label={`Editar ${a.name}`} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"><Edit2 className="h-4 w-4" aria-hidden="true" /></button>
                    <button onClick={() => handleDelete(a.id)} aria-label={`Eliminar ${a.name}`} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && <ActivityFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editItem && <ActivityFormModal activity={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }} />}
    </AppShell>
  );
}

function ActivityFormModal({ activity, onClose, onSaved }: { activity?: Activity; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: activity?.name || "",
    description: activity?.description || "",
    defaultDuration: activity?.defaultDuration || 60,
    maxCapacity: activity?.maxCapacity || 1,
    color: activity?.color || "#6366f1",
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const res = await fetch(activity ? `/api/activities/${activity.id}` : "/api/activities", {
      method: activity ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: activity ? "Actualizada" : "Creada", variant: "success" }); onSaved(); }
    else { toast({ title: "Error", variant: "error" }); setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader><DialogTitle>{activity ? "Editar actividad" : "Nueva actividad"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input label="Nombre *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Descripción" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duración (min)" type="number" value={form.defaultDuration} onChange={(e) => setForm((f) => ({ ...f, defaultDuration: parseInt(e.target.value) }))} />
            <Input label="Capacidad máx." type="number" value={form.maxCapacity} onChange={(e) => setForm((f) => ({ ...f, maxCapacity: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
            <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-10 w-full rounded-xl border-2 border-gray-200 cursor-pointer" />
          </div>
          <Button size="lg" className="w-full" onClick={save} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
