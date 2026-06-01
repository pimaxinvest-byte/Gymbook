"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Users, TrendingUp, CreditCard, CheckCircle, XCircle, Clock, RefreshCw, ClipboardList, BarChart2, ScrollText } from "lucide-react";
import Link from "next/link";

interface TeacherStats {
  today: number;
  week: number;
  month: number;
  quarter: number;
  available: number;
  cancelled: number;
  completed: number;
  occupancyRate: number;
  activeClients: number;
  creditsPendingBalance: number;
  recentBookings: {
    id: string;
    startDatetime: string;
    status: string;
    clientName: string | null;
    activityName: string;
    spaceName: string;
  }[];
  topClients: { clientId: string | null; name: string; count: number }[];
}

const STATUS_COLOR: Record<string, string> = {
  BOOKED: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  AVAILABLE: "bg-gray-100 text-gray-500",
};

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/teacher/stats");
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <AppShell title="Mi Dashboard">
      <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>
    </AppShell>
  );

  if (!stats) return (
    <AppShell title="Mi Dashboard">
      <div className="p-4 text-center text-gray-400">No se pudieron cargar las estadísticas</div>
    </AppShell>
  );

  return (
    <AppShell title="Mi Dashboard">
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Link href="/teacher/schedule">
            <Button size="sm" variant="outline"><Calendar className="h-4 w-4" /> Planning</Button>
          </Link>
          <Link href="/teacher/clients">
            <Button size="sm" variant="outline"><Users className="h-4 w-4" /> Clientes</Button>
          </Link>
          <Link href="/teacher/import">
            <Button size="sm" variant="outline"><RefreshCw className="h-4 w-4" /> Importar Harbiz</Button>
          </Link>
          <Link href="/teacher/logs">
            <Button size="sm" variant="outline"><ScrollText className="h-4 w-4" /> Registro</Button>
          </Link>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Calendar} label="Hoy" value={stats.today} color="orange" />
          <StatCard icon={Calendar} label="Esta semana" value={stats.week} color="orange" />
          <StatCard icon={TrendingUp} label="Este mes" value={stats.month} color="blue" />
          <StatCard icon={TrendingUp} label="Trimestre" value={stats.quarter} color="blue" />
        </div>

        {/* Occupancy + clients */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-orange-500">{stats.occupancyRate}%</div>
            <p className="text-xs text-gray-500 mt-1 text-center">Ocupación<br/>mensual</p>
          </div>
          <div className="col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-green-500">{stats.completed}</div>
            <p className="text-xs text-gray-500 mt-1 text-center">Completadas<br/>este mes</p>
          </div>
          <div className="col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-red-400">{stats.cancelled}</div>
            <p className="text-xs text-gray-500 mt-1 text-center">Canceladas<br/>este mes</p>
          </div>
        </div>

        {/* Clients + credits pending */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Clientes activos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.activeClients}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-gray-500 font-medium">Créditos pendientes</span>
            </div>
            <p className="text-2xl font-bold text-amber-500">{stats.creditsPendingBalance}</p>
            <p className="text-xs text-gray-400">créditos sin pagar</p>
          </div>
        </div>

        {/* Available slots */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-800">Huecos disponibles este mes</p>
            <p className="text-xs text-orange-600 mt-0.5">Sesiones abiertas sin reservar</p>
          </div>
          <span className="text-3xl font-black text-orange-500">{stats.available}</span>
        </div>

        {/* Top clients */}
        {stats.topClients.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart2 className="h-4 w-4 text-orange-500" /> Top clientes (este mes)</CardTitle></CardHeader>
            <CardContent className="space-y-0">
              {stats.topClients.map((c, i) => (
                <div key={c.clientId ?? i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-500">{c.count} ses.</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent bookings */}
        {stats.recentBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-orange-500" /> Últimas reservas</span>
                <Link href="/teacher/schedule" className="text-xs text-orange-500 font-medium">Ver planning →</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {stats.recentBookings.map((b) => {
                const dt = new Date(b.startDatetime);
                const dateStr = dt.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" });
                const timeStr = dt.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.clientName ?? "Disponible"}</p>
                      <p className="text-xs text-gray-400">{b.activityName} · {dateStr} {timeStr}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[b.status] ?? "bg-gray-100 text-gray-500"}`}>{b.status}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Harbiz import button */}
        <div className="bg-white rounded-2xl border-2 border-dashed border-orange-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Importar desde Harbiz</p>
            <p className="text-xs text-gray-400 mt-0.5">Sincroniza clientes, sesiones y bonos</p>
          </div>
          <Link href="/teacher/import">
            <Button size="sm" variant="outline">
              <RefreshCw className="h-4 w-4" /> Importar
            </Button>
          </Link>
        </div>

      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: "orange" | "blue" }) {
  const colorClass = color === "orange" ? "text-orange-500" : "text-blue-500";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-3xl font-black ${colorClass}`}>{value}</p>
    </div>
  );
}
