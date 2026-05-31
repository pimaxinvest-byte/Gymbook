"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Send,
  Users,
  RefreshCw,
  Loader2,
  MessageSquare,
} from "lucide-react";

interface TelegramUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "CLIENT";
  telegramChatId: string | null;
  telegramConnected: boolean;
  telegramUsername: string | null;
  createdAt: string;
}

interface NotificationLogEntry {
  id: string;
  type: string;
  recipient: string;
  success: boolean;
  error: string | null;
  createdAt: string;
  booking: { id: string } | null;
}

interface TelegramSettings {
  botName: string | null;
  botToken: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Profesor",
  CLIENT: "Cliente",
};

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  TEACHER: "bg-orange-100 text-orange-700",
  CLIENT: "bg-blue-100 text-blue-700",
};

export default function TelegramAdminPage() {
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Webhook test state
  const [testing, setTesting] = useState(false);
  const [testWebhook, setTestWebhook] = useState<boolean | null>(null);

  // Test message state
  const [testChatId, setTestChatId] = useState("");
  const [testMessage, setTestMessage] = useState("Hola! Mensaje de prueba desde GymBook 👋");
  const [sendingTest, setSendingTest] = useState(false);

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set(["TEACHER", "CLIENT"]));
  const [broadcasting, setBroadcasting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [settingsRes, usersRes, logsRes] = await Promise.all([
        fetch("/api/settings/telegram"),
        fetch("/api/admin/telegram/users"),
        fetch("/api/admin/telegram/logs"),
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleVerifyWebhook() {
    setTesting(true);
    setTestWebhook(null);
    const res = await fetch("/api/settings/telegram/test", { method: "POST" });
    setTestWebhook(res.ok);
    if (res.ok) {
      toast({ title: "Webhook verificado correctamente", variant: "success" });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: (d as { error?: string }).error || "Error al verificar webhook", variant: "error" });
    }
    setTesting(false);
  }

  async function handleSendTest() {
    if (!testChatId.trim()) {
      toast({ title: "Introduce un Chat ID", variant: "error" });
      return;
    }
    setSendingTest(true);
    const res = await fetch("/api/admin/telegram/send-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: testChatId, message: testMessage }),
    });
    if (res.ok) {
      toast({ title: "Mensaje enviado correctamente", variant: "success" });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: (d as { error?: string }).error || "Error al enviar", variant: "error" });
    }
    setSendingTest(false);
  }

  async function handleBroadcast() {
    if (!broadcastMsg.trim()) {
      toast({ title: "El mensaje no puede estar vacío", variant: "error" });
      return;
    }
    if (selectedRoles.size === 0) {
      toast({ title: "Selecciona al menos un rol", variant: "error" });
      return;
    }
    setBroadcasting(true);
    const res = await fetch("/api/admin/telegram/broadcast-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: broadcastMsg, roles: Array.from(selectedRoles) }),
    });
    const d = await res.json().catch(() => ({})) as { sent?: number; errors?: number; error?: string };
    if (res.ok) {
      toast({
        title: `Enviado a ${d.sent ?? 0} usuario(s)${d.errors ? `, ${d.errors} error(es)` : ""}`,
        variant: d.errors ? "error" : "success",
      });
      setBroadcastMsg("");
    } else {
      toast({ title: d.error || "Error al enviar", variant: "error" });
    }
    setBroadcasting(false);
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  const connectedUsers = users.filter((u) => u.telegramConnected);

  return (
    <AppShell title="Panel Telegram">
      <div className="p-4 max-w-2xl mx-auto space-y-5">

        {/* Section 1: Bot Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              Estado del Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">
                  {settings?.botName ? `@${settings.botName}` : "@Daddysgymbook_bot"}
                </p>
                <p className="text-xs text-gray-500">Bot de Telegram</p>
              </div>
              <div className="flex items-center gap-1.5">
                {testWebhook === null ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                ) : testWebhook ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="text-xs text-gray-500">
                  {testWebhook === null ? "Sin verificar" : testWebhook ? "Activo" : "Error"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleVerifyWebhook} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Verificar webhook
              </Button>
            </div>

            {/* Send test message */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Enviar mensaje de prueba</p>
              <input
                type="text"
                placeholder="Chat ID (ej. 123456789)"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                className="w-full h-10 rounded-xl border-2 border-gray-200 px-3 text-sm focus:outline-none focus:border-orange-400"
              />
              <textarea
                rows={2}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none"
              />
              <Button size="sm" onClick={handleSendTest} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar mensaje de prueba
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Connected Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              Usuarios conectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  <span className="font-semibold text-gray-900">{connectedUsers.length}</span> de{" "}
                  <span className="font-semibold text-gray-900">{users.length}</span> usuarios tienen Telegram conectado
                </p>
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${u.telegramConnected ? "bg-blue-500" : "bg-gray-300"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLOR[u.role] || "bg-gray-100 text-gray-600"}`}>
                            {ROLE_LABEL[u.role] || u.role}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {u.telegramConnected ? (
                          <p className="text-xs font-mono text-blue-600">{u.telegramUsername || u.telegramChatId}</p>
                        ) : (
                          <p className="text-xs text-gray-300">Sin conectar</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No hay usuarios registrados</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Broadcast */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-500" />
              Envío masivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Destinatarios</p>
              <div className="flex gap-3">
                {(["TEACHER", "CLIENT", "ADMIN"] as const).map((role) => (
                  <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.has(role)}
                      onChange={() => toggleRole(role)}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm text-gray-700">{ROLE_LABEL[role]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Mensaje</p>
              <textarea
                rows={4}
                placeholder="Escribe tu mensaje aquí..."
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none"
              />
            </div>
            <Button size="sm" onClick={handleBroadcast} disabled={broadcasting || !broadcastMsg.trim()}>
              {broadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a seleccionados
            </Button>
          </CardContent>
        </Card>

        {/* Section 4: Notification Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-gray-500" />
              Log de notificaciones recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin notificaciones registradas</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                    <span className="mt-0.5 flex-shrink-0">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="text-[10px] px-1.5 py-0.5">{log.type}</Badge>
                        <p className="text-xs text-gray-600 truncate">{log.recipient}</p>
                      </div>
                      {log.error && <p className="text-xs text-red-400 mt-0.5">{log.error}</p>}
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(log.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
