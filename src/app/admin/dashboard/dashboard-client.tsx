"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp, Users, Activity, BarChart2, MessageCircle, UserPlus } from "lucide-react";
import { GymCalendar } from "@/components/calendar/gym-calendar";
import Link from "next/link";

interface Stats {
  today: number;
  week: number;
  month: number;
  total: number;
  byTeacher: { teacherId: string; name: string; count: number }[];
  byActivity: { activityId: string; name: string; count: number }[];
}

export function AdminDashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  }, []);

  return (
    <AppShell title="Dashboard">
      <div className="p-4 space-y-5 max-w-2xl mx-auto">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Calendar} label="Hoy" value={stats?.today ?? "-"} color="bg-indigo-500" />
          <StatCard icon={TrendingUp} label="Esta semana" value={stats?.week ?? "-"} color="bg-purple-500" />
          <StatCard icon={BarChart2} label="Este mes" value={stats?.month ?? "-"} color="bg-blue-500" />
          <StatCard icon={Activity} label="Total" value={stats?.total ?? "-"} color="bg-emerald-500" />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/admin/stats", label: "Estadísticas", icon: BarChart2 },
            { href: "/admin/teachers", label: "Profesores", icon: Users },
            { href: "/admin/spaces", label: "Espacios", icon: MapPinIcon },
            { href: "/admin/activities", label: "Actividades", icon: Activity },
            { href: "/settings", label: "Configuración", icon: SettingsIcon },
            { href: "/admin/telegram", label: "Telegram", icon: MessageCircle },
            { href: "/admin/invite", label: "Invitar", icon: UserPlus },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-gray-800">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Top teachers */}
        {stats?.byTeacher && stats.byTeacher.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top profesores (este mes)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.byTeacher.map((t, i) => (
                  <div key={t.teacherId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-600">{t.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar mini */}
        <Card>
          <CardHeader>
            <CardTitle>Calendario</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <GymCalendar initialView="listWeek" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
