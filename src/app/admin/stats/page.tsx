"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { ChartCard } from "@/components/stats/chart-card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────

interface StatsData {
  period: { from: string; to: string };
  totalBookings: number;
  totalHours: number;
  availableSlots: number;
  cancelledBookings: number;
  occupancyRate: number;
  checkIns: number;
  noShows: number;
  byWeekday: { day: string; count: number }[];
  byHour: { hour: string; count: number }[];
  byActivity: { activityId: string; name: string; count: number }[];
  byTeacher: { teacherId: string; name: string; count: number }[];
  bySpace: { spaceId: string; name: string; count: number }[];
  weeklyTrend: { week: string; count: number }[];
  creditSummary: {
    totalCredits: number;
    totalAssigned: number;
    totalPaid: number;
    unpaidCount: number;
    partialCount: number;
  };
  insights: {
    topDemandDay: string;
    topTimeSlot: string;
    topTeacher: string;
    topActivity: string;
  };
}

interface FilterOption {
  id: string;
  name: string;
}

type Period = "today" | "week" | "month" | "quarter" | "custom";

const PIE_COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#fde68a", "#fcd34d"];

// ── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

function StatsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-10" />
      <Skeleton className="h-56" />
      <Skeleton className="h-56" />
      <Skeleton className="h-56" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function StatsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [teacherFilter, setTeacherFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [spaceFilter, setSpaceFilter] = useState("");

  const [teachers, setTeachers] = useState<FilterOption[]>([]);
  const [activities, setActivities] = useState<FilterOption[]>([]);
  const [spaces, setSpaces] = useState<FilterOption[]>([]);

  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load filter options once
  useEffect(() => {
    Promise.all([
      fetch("/api/teachers").then((r) => r.ok ? r.json() : []),
      fetch("/api/activities").then((r) => r.ok ? r.json() : []),
      fetch("/api/spaces").then((r) => r.ok ? r.json() : []),
    ]).then(([t, a, s]) => {
      setTeachers(
        (t as Array<{ id: string; user?: { name: string }; name?: string }>).map((x) => ({
          id: x.id,
          name: x.user?.name ?? x.name ?? x.id,
        }))
      );
      setActivities(
        (a as Array<{ id: string; name: string }>).map((x) => ({ id: x.id, name: x.name }))
      );
      setSpaces(
        (s as Array<{ id: string; name: string }>).map((x) => ({ id: x.id, name: x.name }))
      );
    }).catch(() => {});
  }, []);

  const fetchStats = useCallback(() => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ period });
    if (period === "custom") {
      if (customStart) params.set("start", customStart);
      if (customEnd) params.set("end", customEnd);
    }
    if (teacherFilter) params.set("teacherId", teacherFilter);
    if (activityFilter) params.set("activityId", activityFilter);
    if (spaceFilter) params.set("spaceId", spaceFilter);

    fetch(`/api/stats?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar estadísticas");
        return r.json();
      })
      .then((d: StatsData) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period, customStart, customEnd, teacherFilter, activityFilter, spaceFilter]);

  useEffect(() => {
    if (period !== "custom" || (customStart && customEnd)) {
      fetchStats();
    }
  }, [fetchStats, period, customStart, customEnd]);

  const weekLabels = data?.weeklyTrend.map((w) => {
    const parts = w.week.split("-W");
    return `W${parts[1]}`;
  }) ?? [];

  return (
    <AppShell title="Estadísticas">
      <div className="p-4 space-y-5 max-w-3xl mx-auto pb-24">

        {/* Period Selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl overflow-x-auto">
          {(["today", "week", "month", "quarter", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                period === p
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p === "today" ? "Hoy" : p === "week" ? "Semana" : p === "month" ? "Mes" : p === "quarter" ? "Trimestre" : "Personalizado"}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {period === "custom" && (
          <div className="flex gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Inicio"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Fin"
            />
          </div>
        )}

        {/* Filters row */}
        <div className="flex gap-2 overflow-x-auto">
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="flex-shrink-0 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Todos los profes</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="flex-shrink-0 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Todas las actividades</option>
            {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={spaceFilter}
            onChange={(e) => setSpaceFilter(e.target.value)}
            className="flex-shrink-0 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">Todos los espacios</option>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-700 font-medium">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && <StatsSkeleton />}

        {/* Content */}
        {!loading && data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                emoji="📊"
                label="Total Reservas"
                value={String(data.totalBookings)}
              />
              <StatCard
                emoji="⏱️"
                label="Horas Impartidas"
                value={`${data.totalHours.toFixed(1)}h`}
              />
              <StatCard
                emoji="✅"
                label="Tasa Ocupación"
                value={`${data.occupancyRate.toFixed(1)}%`}
                highlight
              />
              <StatCard
                emoji="❌"
                label="Cancelaciones"
                value={String(data.cancelledBookings)}
              />
            </div>

            {/* Extra metrics row */}
            <div className="flex gap-2 overflow-x-auto">
              <MiniStat label="Check-ins" value={data.checkIns} />
              <MiniStat label="No-shows" value={data.noShows} />
              <MiniStat label="Disponibles" value={data.availableSlots} />
            </div>

            {/* Smart insight chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <InsightChip emoji="🔥" label="Día top" value={data.insights.topDemandDay} />
              <InsightChip emoji="⏰" label="Franja top" value={data.insights.topTimeSlot} />
              <InsightChip emoji="👨‍🏫" label="Profesor top" value={data.insights.topTeacher} />
              <InsightChip emoji="🏃" label="Actividad top" value={data.insights.topActivity} />
            </div>

            {/* Charts */}

            {/* Bookings by weekday */}
            {data.byWeekday.some((d) => d.count > 0) && (
              <ChartCard title="Reservas por día de semana">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byWeekday} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} name="Reservas" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* By hour */}
            {data.byHour.length > 0 && (
              <ChartCard title="Franjas horarias">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byHour} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#fb923c" radius={[6, 6, 0, 0]} name="Reservas" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Weekly trend */}
            <ChartCard title="Tendencia semanal (últimas 8 semanas)">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={data.weeklyTrend.map((w, i) => ({ ...w, label: weekLabels[i] }))}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={{ fill: "#f97316", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Reservas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* By activity — Pie */}
            {data.byActivity.length > 0 && (
              <ChartCard title="Reservas por actividad">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.byActivity}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      label={({ name, payload }: any) => `${name} (${payload?.count ?? 0})`}
                      labelLine={{ stroke: "#e5e7eb" }}
                    >
                      {data.byActivity.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Teacher ranking */}
            {data.byTeacher.length > 0 && (
              <ChartCard title="Ranking de profesores (top 5)">
                <ResponsiveContainer width="100%" height={Math.max(160, data.byTeacher.length * 48)}>
                  <BarChart
                    data={data.byTeacher}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#f97316" radius={[0, 6, 6, 0]} name="Reservas" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* By space */}
            {data.bySpace.length > 0 && (
              <ChartCard title="Ocupación por espacio">
                <ResponsiveContainer width="100%" height={Math.max(160, data.bySpace.length * 48)}>
                  <BarChart
                    data={data.bySpace}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#fdba74" radius={[0, 6, 6, 0]} name="Reservas" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Credit summary */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen de créditos</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Paquetes totales</p>
                    <p className="text-lg font-black text-gray-900">{data.creditSummary.totalCredits}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Créditos asignados</p>
                    <p className="text-lg font-black text-gray-900">{data.creditSummary.totalAssigned}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Total cobrado</p>
                    <p className="text-lg font-black text-emerald-700">€{data.creditSummary.totalPaid.toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Sin pagar / Parcial</p>
                    <p className="text-lg font-black text-red-700">
                      {data.creditSummary.unpaidCount} / {data.creditSummary.partialCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  emoji, label, value, highlight = false,
}: {
  emoji: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-lg ${highlight ? "bg-orange-500" : "bg-orange-50"}`}>
          {emoji}
        </div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-shrink-0 bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm text-center min-w-[80px]">
      <p className="text-base font-black text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

function InsightChip({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5">
      <span className="text-base">{emoji}</span>
      <div>
        <p className="text-[9px] text-orange-600 font-semibold leading-none">{label}</p>
        <p className="text-xs font-bold text-gray-800 leading-tight">{value}</p>
      </div>
    </div>
  );
}
