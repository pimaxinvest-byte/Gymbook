"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, MapPin } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Space { id: string; name: string; description?: string; capacity: number; isActive: boolean }

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editSpace, setEditSpace] = useState<Space | null>(null);

  async function load() {
    const r = await fetch("/api/spaces");
    setSpaces(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar este espacio?")) return;
    await fetch(`/api/spaces/${id}`, { method: "DELETE" });
    toast({ title: "Espacio desactivado", variant: "success" });
    load();
  }

  return (
    <AppShell title="Espacios">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{spaces.length} espacios activos</p>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Añadir</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
        ) : (
          <div className="space-y-3">
            {spaces.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">Capacidad: {s.capacity} · {s.description || "Sin descripción"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditSpace(s)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && <SpaceFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editSpace && <SpaceFormModal space={editSpace} onClose={() => setEditSpace(null)} onSaved={() => { setEditSpace(null); load(); }} />}
    </AppShell>
  );
}

function SpaceFormModal({ space, onClose, onSaved }: { space?: Space; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: space?.name || "", description: space?.description || "", capacity: space?.capacity || 1 });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const res = await fetch(space ? `/api/spaces/${space.id}` : "/api/spaces", {
      method: space ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { toast({ title: space ? "Actualizado" : "Creado", variant: "success" }); onSaved(); }
    else { toast({ title: "Error", variant: "error" }); setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader><DialogTitle>{space ? "Editar espacio" : "Nuevo espacio"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input label="Nombre *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Descripción" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Capacidad" type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value) }))} />
          <Button size="lg" className="w-full" onClick={save} disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
