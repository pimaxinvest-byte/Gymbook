"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Loader2, Save, Send, Shield, MessageCircle, ExternalLink } from "lucide-react";
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
  cancellationRefundCredits: boolean;
  creditExpiryMonths: number;
  sgtMaxClients: number;
}

interface TelegramSettings {
  botToken: string;
  botName: string;
  adminChatId: string;
  notifyAdmin: boolean;
  notifyTeacher: boolean;
  notifyClient: boolean;
}

interface Profile {
  name: string;
  email: string;
  avatarUrl?: string | null;
  telegramChatId?: string | null;
  telegramConnected?: boolean;
  telegramUsername?: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [telegram, setTelegram] = useState<Partial<TelegramSettings>>({});
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [connectingTelegram, setConnectingTelegram] = useState(false);

  useEffect(() => {
    const promises: Promise<void>[] = [
      fetch("/api/profile").then((r) => r.json()).then(setProfile),
    ];
    if (isAdmin) {
      promises.push(
        fetch("/api/settings").then((r) => r.json()).then(setSettings),
        fetch("/api/settings/telegram").then((r) => r.json()).then(setTelegram),
      );
    }
    Promise.all(promises).then(() => setLoading(false));
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

  async function saveProfile() {
    setSavingProfile(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profile.name, telegramChatId: profile.telegramChatId }),
    });
    toast({ title: res.ok ? "Perfil actualizado ✓" : "Error", variant: res.ok ? "success" : "error" });
    setSavingProfile(false);
  }

  async function connectTelegram() {
    setConnectingTelegram(true);
    const res = await fetch("/api/telegram/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, "_blank");
      toast({ title: "Enlace de Telegram abierto. Escribe /start en el bot.", variant: "success" });
    } else {
      toast({ title: "Error: configura el bot de Telegram en ajustes admin", variant: "error" });
    }
    setConnectingTelegram(false);
  }

  if (loading) {
    return (
      <AppShell title="Ajustes">
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Ajustes">
      <div className="p-4 max-w-2xl mx-auto space-y-5">

        {/* My profile */}
        <Card>
          <CardHeader><CardTitle>Mi perfil</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar
                name={profile.name || ""}
                avatarUrl={profile.avatarUrl}
                telegramChatId={profile.telegramChatId}
                size="lg"
                editable
                onUpdated={(url) => setProfile((p) => ({ ...p, avatarUrl: url }))}
              />
              <div>
                <p className="font-semibold text-gray-900">{profile.name}</p>
                <p className="text-sm text-gray-500">{profile.email}</p>
                {profile.telegramConnected ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                    <span className="text-xs text-blue-600 font-medium">
                      Telegram {profile.telegramUsername ? `(${profile.telegramUsername})` : "conectado"}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={connectTelegram}
                    disabled={connectingTelegram}
                    className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-50"
                  >
                    {connectingTelegram ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                    Conectar Telegram
                  </button>
                )}
              </div>
            </div>

            <Input
              label="Nombre"
              value={profile.name || ""}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
            {/* Telegram connect button (full width) */}
            <button
              onClick={connectTelegram}
              disabled={connectingTelegram}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                profile.telegramConnected
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
              }`}
            >
              {connectingTelegram ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {profile.telegramConnected ? "Reconectar Telegram" : "Conectar Telegram"}
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </button>

            <Button size="lg" className="w-full" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /> Guardar perfil</>}
            </Button>
          </CardContent>
        </Card>

        {/* Admin-only sections */}
        {isAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-orange-500" aria-hidden="true" />
                  General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input label="Nombre del gimnasio" value={settings.gymName || ""} onChange={(e) => setSettings((s) => ({ ...s, gymName: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Abre" type="time" value={settings.openingTime || "06:00"} onChange={(e) => setSettings((s) => ({ ...s, openingTime: e.target.value }))} />
                  <Input label="Cierra" type="time" value={settings.closingTime || "22:00"} onChange={(e) => setSettings((s) => ({ ...s, closingTime: e.target.value }))} />
                  <Input label="Duración sesión (min)" type="number" value={settings.defaultSessionDuration ?? 60} onChange={(e) => setSettings((s) => ({ ...s, defaultSessionDuration: parseInt(e.target.value) }))} />
                  <Input label="SGT máx clientes" type="number" min={2} max={10} value={settings.sgtMaxClients ?? 5} onChange={(e) => setSettings((s) => ({ ...s, sgtMaxClients: parseInt(e.target.value) }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Color principal</label>
                    <input type="color" value={settings.primaryColor || "#f97316"} onChange={(e) => setSettings((s) => ({ ...s, primaryColor: e.target.value }))} className="h-10 w-full rounded-xl border-2 border-gray-200 cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Color secundario</label>
                    <input type="color" value={settings.secondaryColor || "#ea580c"} onChange={(e) => setSettings((s) => ({ ...s, secondaryColor: e.target.value }))} className="h-10 w-full rounded-xl border-2 border-gray-200 cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Texto de confirmación</label>
                  <textarea rows={2} value={settings.bookingConfirmationText || ""} onChange={(e) => setSettings((s) => ({ ...s, bookingConfirmationText: e.target.value }))} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-orange-400 focus:outline-none resize-none" />
                </div>
                <Button size="lg" className="w-full" onClick={saveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /> Guardar</>}
                </Button>
              </CardContent>
            </Card>

            {/* Cancellation policy */}
            <Card>
              <CardHeader><CardTitle>Política de cancelación</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input
                  label="Cancelación gratuita antes de (horas)"
                  type="number"
                  min={0}
                  value={settings.cancellationHoursLimit ?? 24}
                  onChange={(e) => setSettings((s) => ({ ...s, cancellationHoursLimit: parseInt(e.target.value) }))}
                />
                <Input
                  label="Créditos caducan en (meses)"
                  type="number"
                  min={1}
                  max={24}
                  value={settings.creditExpiryMonths ?? 6}
                  onChange={(e) => setSettings((s) => ({ ...s, creditExpiryMonths: parseInt(e.target.value) }))}
                />
                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Devolver crédito al cancelar a tiempo</span>
                    <p className="text-xs text-gray-400">Si el cliente cancela antes del límite de horas, se devuelve el crédito</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.cancellationRefundCredits ?? true}
                    onChange={(e) => setSettings((s) => ({ ...s, cancellationRefundCredits: e.target.checked }))}
                    className="w-5 h-5 rounded accent-orange-500"
                  />
                </label>
                <Button size="lg" className="w-full" onClick={saveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /> Guardar política</>}
                </Button>
              </CardContent>
            </Card>

            {/* Telegram settings */}
            <Card>
              <CardHeader><CardTitle>Telegram Bot</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input label="Bot Token" type="password" placeholder="Token del bot (enmascarado)" value={telegram.botToken || ""} onChange={(e) => setTelegram((t) => ({ ...t, botToken: e.target.value }))} />
                <Input label="Nombre del bot (sin @)" value={telegram.botName || ""} placeholder="Ej: Daddysgymbook_bot" onChange={(e) => setTelegram((t) => ({ ...t, botName: e.target.value }))} />
                <Input label="Chat ID del administrador" value={telegram.adminChatId || ""} placeholder="Ej: 123456789" onChange={(e) => setTelegram((t) => ({ ...t, adminChatId: e.target.value }))} />

                <div className="space-y-2">
                  {[
                    { key: "notifyAdmin", label: "Notificar al admin" },
                    { key: "notifyTeacher", label: "Notificar al profesor" },
                    { key: "notifyClient", label: "Notificar al cliente" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 cursor-pointer">
                      <span className="text-sm text-gray-700">{label}</span>
                      <input
                        type="checkbox"
                        checked={!!telegram[key as keyof TelegramSettings]}
                        onChange={(e) => setTelegram((t) => ({ ...t, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-orange-500"
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
              <CardContent className="space-y-0">
                {[
                  { href: "/admin/dashboard",  label: "Dashboard" },
                  { href: "/admin/teachers",   label: "Profesores" },
                  { href: "/admin/clients",    label: "Clientes" },
                  { href: "/admin/spaces",     label: "Espacios" },
                  { href: "/admin/activities", label: "Actividades" },
                ].map((item) => (
                  <a key={item.href} href={item.href} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 text-sm font-medium text-gray-800 hover:text-orange-500 transition-colors">
                    {item.label}
                    <span className="text-gray-400">›</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">GymBook v1.2.0 · Creado por Pietro</p>
      </div>
    </AppShell>
  );
}
