"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogItem {
  id: string;
  startDatetime: string;
  endDatetime: string;
  status: string;
  sessionType: string;
  clientName: string | null;
  activityName: string;
  spaceName: string;
  createdAt: string;
  updatedAt: string;
}

interface LogsResponse {
  total: number;
  page: number;
  pages: number;
  items: LogItem[];
}

const STATUS_STYLE: Record<string, string> = {
  BOOKED:    "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100  text-green-700",
  CANCELLED: "bg-red-100    text-red-700",
  AVAILABLE: "bg-gray-100   text-gray-500",
  BLOCKED:   "bg-purple-100 text-purple-700",
};

const DAYS_OPTIONS = [7, 14, 30, 90];
const STATUS_OPTIONS = ["", "BOOKED", "COMPLETED", "CANCELLED", "AVAILABLE"];

export default function TeacherLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days), page: String(page) });
    if (status) params.set("status", status);
    const res = await fetch(`/api/teacher/logs?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [days, status, page]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  function setFilter(newDays?: number, newStatus?: string) {
    setPage(1);
    if (newDays !== undefined) setDays(newDays);
    if (newStatus !== undefined) setStatus(newStatus);
  }

  return (
    <AppShell title="Registro de sesiones">
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Days filter */}
          <div className="flex gap-1">
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setFilter(d)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${days === d ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={e => setFilter(undefined, e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 cursor-pointer"
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.filter(Boolean).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button onClick={load} className="ml-auto text-gray-400 hover:text-orange-500 cursor-pointer">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        {data && (
          <p className="text-xs text-gray-500">
            {data.total} resultado{data.total !== 1 ? "s" : ""} · últimos {days} días
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>
        ) : data && data.items.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">No hay sesiones en este período</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {data?.items.map(item => {
              const start = new Date(item.startDatetime);
              const dateStr = start.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" });
              const timeStr = start.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Date block */}
                  <div className="text-center w-12 flex-shrink-0">
                    <p className="text-[10px] text-gray-400 leading-none capitalize">{dateStr.split(" ")[0]}</p>
                    <p className="text-base font-bold text-gray-900 leading-tight">{start.getDate()}</p>
                    <p className="text-[10px] text-gray-400 leading-none">{timeStr}</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.clientName ?? "Sin cliente"}</p>
                    <p className="text-xs text-gray-400 truncate">{item.activityName} · {item.spaceName}</p>
                  </div>

                  {/* Status badge */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[item.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <span className="text-xs text-gray-500">Página {page} de {data.pages}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.pages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
