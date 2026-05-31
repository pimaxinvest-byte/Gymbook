"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Loader2, Save, Send, Shield, MessageCircle, ExternalLink, Plus, Trash2, Receipt } from "lucide-react";
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

interface BonoPreset {
  id: string;
  name: string;
  sessions: number;
  price: number;
  creditType: "INDIVIDUAL" | "SGT";
  isActive: boolean;
  sortOrder: number;
}

interface BillingSettings {
  id?: string;
  businessName?: string;
  nif?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  issueDocuments?: boolean;
  documentType?: "TICKET" | "INVOICE";
  invoicePrefix?: string;
  ticketPrefix?: string;
  footerNote?: string;
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

  // Bonos
  const [bonoPresets, setBonoPresets] = useState<BonoPreset[]>([]);
  const [newBono, setNewBono] = useState({ name: "", sessions: 10, price: 0, creditType: "INDIVIDUAL" as "INDIVIDUAL" | "SGT" });
  const [savingBono, setSavingBono] = useState(false);

  // Billing settings (teacher's own)
  const [billing, setBilling] = useState<Partial<BillingSettings>>({});
  const [savingBilling, setSavingBilling] = useState(false);

  useEffect(() => {
    const promises: Promise<void>[] = [
      fetch("/api/profile").then((r) => r.json()).then(setProfile),
      fetch("/api/admin/bono-presets").then((r) => r.json()).then((d) => Array.isArray(d) && setBonoPresets(d)),
      fetch("/api/teacher/billing").then((r) => r.json()).then((d) => d && !d.error && setBilling(d)),
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

  async function addBonoPreset() {
    if (!newBono.name || newBono.price <= 0) { toast({ title: "Completa nombre y precio", variant: "error" }); return; }
    setSavingBono(true);
    const r = await fetch("/api/admin/bono-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newBono, sortOrder: bonoPresets.length }),
    });
    if (r.ok) {
      const p = await r.json();
      setBonoPresets((prev) => [...prev, p]);
      setNewBono({ name: "", sessions: 10, price: 0, creditType: "INDIVIDUAL" });
      toast({ title: "Bono creado", variant: "success" });
    } else {
      toast({ title: "Error al crear bono", variant: "error" });
    }
    setSavingBono(false);
  }

  async function deleteBono(id: string) {
    if (!confirm("¿Eliminar este bono?")) return;
    const r = await fetch(`/api/admin/bono-presets?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      setBonoPresets((prev) => prev.filter((b) => b.id !== id));
      toast({ title: "Bono eliminado", variant: "success" });
    }
  }

  async function toggleBonoActive(bono: BonoPreset) {
    const r = await fetch("/api/admin/bono-presets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bono.id, isActive: !bono.isActive }),
    });
    if (r.ok) {
      const updated = await r.json();
      setBonoPresets((prev) => prev.map((b) => b.id === bono.id ? updated : b));
    }
  }

  async function saveBilling() {
    setSavingBilling(true);
    const r = await fetch("/api/teacher/billing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(billing),
    });
    toast({ title: r.ok ? "Datos de facturación guardados" : "Error", variant: r.ok ? "success" : "error" });
    if (r.ok) setBilling(await r.json());
    setSavingBilling(false);
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

            {/* Bonos (credit package presets) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-orange-500" />
                  Bonos de créditos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-gray-500">Los bonos permiten vender paquetes de créditos a los clientes. El precio por clase se calcula automáticamente.</p>

                {/* Existing presets */}
                <div className="space-y-2">
                  {bonoPresets.map((b) => (
                    <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${b.isActive ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                        <p className="text-xs text-gray-500">
                          {b.sessions} clases · <span className="font-semibold text-orange-600">{b.price}€</span>
                          <span className="ml-2 text-gray-400">({(b.price / b.sessions).toFixed(1)}€/clase)</span>
                          {b.creditType === "SGT" && <span className="ml-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">SGT</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleBonoActive(b)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border-2 cursor-pointer transition-colors ${b.isActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500"}`}
                      >
                        {b.isActive ? "Activo" : "Inactivo"}
                      </button>
                      <button onClick={() => deleteBono(b.id)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {bonoPresets.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No hay bonos configurados</p>}
                </div>

                {/* Add new */}
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nuevo bono</p>
                  <Input label="Nombre" placeholder="Ej: Bono 10 clases" value={newBono.name} onChange={(e) => setNewBono((p) => ({ ...p, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Nº clases" type="number" min={1} value={newBono.sessions} onChange={(e) => setNewBono((p) => ({ ...p, sessions: parseInt(e.target.value) || 1 }))} />
                    <Input label="Precio (€)" type="number" min={0} step={0.01} value={newBono.price} onChange={(e) => setNewBono((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["INDIVIDUAL", "SGT"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setNewBono((p) => ({ ...p, creditType: t }))}
                        className={`h-10 rounded-xl text-xs font-semibold border-2 transition-colors cursor-pointer ${newBono.creditType === t ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600"}`}>
                        {t === "INDIVIDUAL" ? "Individual" : "SGT Grupo"}
                      </button>
                    ))}
                  </div>
                  {newBono.name && newBono.price > 0 && (
                    <p className="text-xs text-center text-gray-500">
                      Precio por clase: <span className="font-semibold text-orange-600">{(newBono.price / newBono.sessions).toFixed(2)}€</span>
                    </p>
                  )}
                  <Button size="lg" className="w-full" onClick={addBonoPreset} disabled={savingBono}>
                    {savingBono ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Añadir bono</>}
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

        {/* Billing / invoice settings — visible to teachers and admins */}
        {(session?.user?.role === "TEACHER" || session?.user?.role === "ADMIN") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-orange-500" />
                Facturación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Configura tus datos fiscales para emitir tiques o facturas a clientes.</p>

              {/* Enable toggle */}
              <label className="flex items-center justify-between py-2 border-b border-gray-100 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-700">Emitir tiques / facturas</span>
                  <p className="text-xs text-gray-400">Activa para poder generar documentos al vender bonos</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!billing.issueDocuments}
                  onChange={(e) => setBilling((b) => ({ ...b, issueDocuments: e.target.checked }))}
                  className="w-5 h-5 rounded accent-orange-500"
                />
              </label>

              {billing.issueDocuments && (
                <>
                  {/* Document type */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Tipo de documento por defecto</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["TICKET", "INVOICE"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setBilling((b) => ({ ...b, documentType: t }))}
                          className={`h-10 rounded-xl text-sm font-semibold border-2 transition-colors cursor-pointer ${billing.documentType === t ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600"}`}>
                          {t === "TICKET" ? "Tique" : "Factura"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Prefijo factura" placeholder="FAC" value={billing.invoicePrefix ?? "FAC"} onChange={(e) => setBilling((b) => ({ ...b, invoicePrefix: e.target.value }))} />
                    <Input label="Prefijo tique" placeholder="TIC" value={billing.ticketPrefix ?? "TIC"} onChange={(e) => setBilling((b) => ({ ...b, ticketPrefix: e.target.value }))} />
                  </div>
                </>
              )}

              <Input label="Nombre / Razón social" value={billing.businessName ?? ""} onChange={(e) => setBilling((b) => ({ ...b, businessName: e.target.value }))} />
              <Input label="NIF / CIF" value={billing.nif ?? ""} onChange={(e) => setBilling((b) => ({ ...b, nif: e.target.value }))} />
              <Input label="Dirección" value={billing.address ?? ""} onChange={(e) => setBilling((b) => ({ ...b, address: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Ciudad" value={billing.city ?? ""} onChange={(e) => setBilling((b) => ({ ...b, city: e.target.value }))} />
                <Input label="CP" value={billing.postalCode ?? ""} onChange={(e) => setBilling((b) => ({ ...b, postalCode: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Teléfono" value={billing.phone ?? ""} onChange={(e) => setBilling((b) => ({ ...b, phone: e.target.value }))} />
                <Input label="Email fiscal" value={billing.email ?? ""} onChange={(e) => setBilling((b) => ({ ...b, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota al pie</label>
                <textarea rows={2} value={billing.footerNote ?? ""} onChange={(e) => setBilling((b) => ({ ...b, footerNote: e.target.value }))} placeholder="Ej: IVA incluido · Autónomo en módulos" className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-orange-400 focus:outline-none resize-none" />
              </div>
              <Button size="lg" className="w-full" onClick={saveBilling} disabled={savingBilling}>
                {savingBilling ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /> Guardar facturación</>}
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">GymBook v1.3.0 · Creado por Pietro</p>
      </div>
    </AppShell>
  );
}
