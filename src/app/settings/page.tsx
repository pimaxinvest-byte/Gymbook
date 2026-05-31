"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Send } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { useSession } from "next-auth/react";

interface Settings {
  gymName: string;
  primaryColor: string;
  secondaryColor: string;
  defaultSessionDuration: number;
  openingTime: string;
  closingTime: string;
  bookingConfirmationText: string;
  cancellationHoursLimit: number;
}

interface TelegramSettings {
  botToken: string;
  adminChatId: string;
  notifyAdmin: boolean;
  notifyTeacher: boolean;
  notifyClient: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [telegram, setTelegram] = useState<Partial<TelegramSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/settings/telegram").then((r) => r.json()),
    ]).then(([s, t]) => {
      setSettings(s);
      setTelegram(t);
      setLoading(false);
    });
  }, [isAdmin]);

  async function saveSettings() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    toast({ title: res.ok ? "Configuración guardada" : "Error al guardar", variant: res.ok ? "success" : "error" });
    setSaving(false);
  }

  async function saveTelegram() {
    setSavingTelegram(true);
    const res = await fetch("/api/settings/telegram", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telegram),
    });
    toast({ title: res.ok ? "Telegram configurado" : "Error", variant: res.ok ? "success" : "error" });
    setSavingTelegram(false);
  }

  async function testTelegram() {
    setTestingTelegram(true);
    const res = await fetch("/api/settings/telegram/test", { method: "POST" });
    toast({ title: res.ok ? "Mensaje de prueba enviado ✓" : "Error al enviar", variant: res.ok ? "success" : "error" });
    setTestingTelegram(false);
  }

  if (!isAdmin) {
    return (
      <AppShell title="Ajustes">
        <div className="p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">Solo los administradores pueden ver esta sección.</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (loading) return <AppShell title="Ajustes"><div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div></AppShell>;

  return (
    <AppShell title="Configuración">
      <div className="p-4 max-w-2xl mx-auto space-y-5">

        {/* General settings */}
        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input label="Nombre del gimnasio" value={settings.gymName || ""} onChange={(e) => setSettings((s) => ({ ...s, gymName: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Abre" type="time" value={settings.openingTime || "06:00"} onChange={(e) => setSettings((s) => ({ ...s, openingTime: e.target.value }))} />
              <Input label="Cierra" type="time" value={settings.closingTime || "22:00"} onChange={(e) => setSettings((s) => ({ ...s, closingTime: e.target.value }))} />
              <Input label="Duración sesión (min)" type="number" value={settings.defaultSessionDuration || 60} onChange={(e) => setSettings((s) => ({ ...s, defaultSessionDuration: parseInt(e.target.value) }))} />
              <Input label="Cancelación antes de (h)" type="number" value={settings.cancellationHoursLimit || 24} onChange={(e) => setSettings((s) => ({ ...s, cancellationHoursLimit: parseInt(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Color principal</label>
                <input type="color" value={settings.primaryColor || "#6366f1"} onChange={(e) => setSettings((s) => ({ ...s, primaryColor: e.target.value }))} className="h-10 w-full rounded-xl border-2 border-gray-200 cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Color secundario</label>
                <input type="color" value={settings.secondaryColor || "#8b5cf6"} onChange={(e) => setSettings((s) => ({ ...s, secondaryColor: e.target.value }))} className="h-10 w-full rounded-xl border-2 border-gray-200 cursor-pointer" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Texto de confirmación de reserva</label>
              <textarea rows={2} value={settings.bookingConfirmationText || ""} onChange={(e) => setSettings((s) => ({ ...s, bookingConfirmationText: e.target.value }))} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none" />
            </div>
            <Button size="lg" className="w-full" onClick={saveSettings} disabled={saving}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /> Guardar</>}
            </Button>
          </CardContent>
        </Card>

        {/* Telegram settings */}
        <Card>
          <CardHeader><CardTitle>Telegram Bot</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input label="Bot Token" type="password" placeholder="El token actual está enmascarado" value={telegram.botToken || ""} onChange={(e) => setTelegram((t) => ({ ...t, botToken: e.target.value }))} />
            <Input label="Chat ID del administrador" value={telegram.adminChatId || ""} placeholder="Ej: 123456789" onChange={(e) => setTelegram((t) => ({ ...t, adminChatId: e.target.value }))} />

            <div className="space-y-2">
              {[
                { key: "notifyAdmin", label: "Notificar al admin" },
                { key: "notifyTeacher", label: "Notificar al profesor" },
                { key: "notifyClient", label: "Notificar al cliente" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={!!telegram[key as keyof TelegramSettings]}
                    onChange={(e) => setTelegram((t) => ({ ...t, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="lg" className="flex-1" onClick={saveTelegram} disabled={savingTelegram}>
                {savingTelegram ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /> Guardar</>}
              </Button>
              <Button variant="outline" size="lg" onClick={testTelegram} disabled={testingTelegram}>
                {testingTelegram ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" /> Test</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin links */}
        <Card>
          <CardHeader><CardTitle>Gestión</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/admin/teachers", label: "👨‍🏫 Profesores" },
              { href: "/admin/spaces", label: "📍 Espacios" },
              { href: "/admin/activities", label: "🏃 Actividades" },
              { href: "/admin/dashboard", label: "📊 Dashboard" },
            ].map((item) => (
              <a key={item.href} href={item.href} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 text-sm font-medium text-gray-800 hover:text-orange-500 transition-colors cursor-pointer">
                {item.label}
                <span className="text-gray-400">›</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
