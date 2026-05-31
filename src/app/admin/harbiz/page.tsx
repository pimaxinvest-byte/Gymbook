"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { HarbizSyncResult, HarbizDiffItem } from "@/integrations/harbiz/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SyncStatus {
  configured: boolean;
  lastSyncAt: string | null;
  isActive: boolean;
  recentLogs: SyncLogEntry[];
}

interface SyncLogEntry {
  id: string;
  status: string;
  dryRun: boolean;
  clientsFound: number;
  clientsCreated: number;
  clientsUpdated: number;
  sessionsFound: number;
  sessionsCreated: number;
  packsFound: number;
  packsCreated: number;
  errors: string[] | null;
  startedAt: string;
  completedAt: string | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function HarbizSyncPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [previewResult, setPreviewResult] = useState<HarbizSyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.replace("/");
    }
  }, [status, session, router]);

  // Load status
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/harbiz/status");
      if (res.ok) setSyncStatus(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Dry-run preview ─────────────────────────────────────────────────────

  async function handlePreview() {
    setLoading(true);
    setError(null);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/harbiz/sync?dryRun=true", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setPreviewResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Confirm real sync ───────────────────────────────────────────────────

  async function handleConfirmSync() {
    if (!confirm("¿Confirmas el sync real? Se escribirán datos en GymBook.")) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/harbiz/sync?dryRun=false", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setPreviewResult(data);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirming(false);
    }
  }

  if (status === "loading") return <LoadingSkeleton />;
  if (!session || session.user.role !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 cursor-pointer">
            ← Volver
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sincronización Harbiz</h1>
            <p className="text-sm text-gray-500">Importa clientes, sesiones y bonos desde Harbiz a GymBook</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Status card */}
        <StatusCard status={syncStatus} />

        {/* Env check warning */}
        {!process.env.HARBIZ_EMAIL && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            ⚠️ Las variables <code className="font-mono bg-amber-100 px-1 rounded">HARBIZ_EMAIL</code> y{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">HARBIZ_PASSWORD</code> deben estar configuradas
            en Railway para que el sync funcione.
          </div>
        )}

        {/* Action buttons */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Sincronizar datos</h2>
          <p className="text-sm text-gray-500 mb-4">
            Primero usa <strong>Previsualizar</strong> para ver qué cambios se harían sin modificar nada.
            Después confirma si todo es correcto.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handlePreview}
              disabled={loading || confirming}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg font-medium transition-colors cursor-pointer"
            >
              {loading ? "Analizando…" : "🔍 Previsualizar sync"}
            </button>
            {previewResult?.status === "DRY_RUN_OK" && (
              <button
                onClick={handleConfirmSync}
                disabled={confirming}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                {confirming ? "Sincronizando…" : "✅ Confirmar sync real"}
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Preview result */}
        {previewResult && <PreviewResult result={previewResult} />}

        {/* Recent sync logs */}
        {syncStatus?.recentLogs && syncStatus.recentLogs.length > 0 && (
          <RecentLogs logs={syncStatus.recentLogs} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusCard({ status }: { status: SyncStatus | null }) {
  if (!status) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-start gap-4">
      <div className={`w-3 h-3 rounded-full mt-1 ${status.configured && status.isActive ? "bg-green-400" : "bg-gray-300"}`} />
      <div>
        <p className="font-medium text-gray-900">
          {status.configured ? "Conexión Harbiz configurada" : "Sin conexión configurada"}
        </p>
        {status.lastSyncAt ? (
          <p className="text-sm text-gray-500">
            Último sync real: {new Date(status.lastSyncAt).toLocaleString("es-ES")}
          </p>
        ) : (
          <p className="text-sm text-gray-400">Nunca sincronizado</p>
        )}
      </div>
    </div>
  );
}

function PreviewResult({ result }: { result: HarbizSyncResult }) {
  const isReal = !result.dryRun;
  const statusColor = result.status === "FAILED" ? "red" : isReal ? "green" : "blue";

  return (
    <div className={`bg-white rounded-xl border-2 border-${statusColor}-200 p-6 space-y-5`}>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isReal ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
          {isReal ? "SYNC REAL" : "DRY-RUN"}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${result.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
          {result.status}
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatBox label="Clientes" found={result.clients.found} create={result.clients.toCreate} update={result.clients.toUpdate} skip={result.clients.skipped} />
        <StatBox label="Sesiones" found={result.sessions.found} create={result.sessions.toCreate} skip={result.sessions.skipped} />
        <StatBox label="Bonos" found={result.packs.found} create={result.packs.toCreate} update={result.packs.toUpdate} />
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Errores ({result.errors.length})</p>
          <ul className="text-xs text-red-600 space-y-0.5">
            {result.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
            {result.errors.length > 10 && <li>…y {result.errors.length - 10} más</li>}
          </ul>
        </div>
      )}

      {/* Diff table */}
      {result.diff.length > 0 && <DiffTable items={result.diff} />}
    </div>
  );
}

function StatBox({ label, found, create, update, skip }: { label: string; found: number; create?: number; update?: number; skip?: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{found}</p>
      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
        {create !== undefined && <p><span className="text-green-600 font-medium">+{create}</span> crear</p>}
        {update !== undefined && update > 0 && <p><span className="text-amber-600 font-medium">~{update}</span> actualizar</p>}
        {skip !== undefined && <p><span className="text-gray-400">{skip}</span> sin cambios</p>}
      </div>
    </div>
  );
}

function DiffTable({ items }: { items: HarbizDiffItem[] }) {
  const actionColor: Record<string, string> = {
    CREATE: "text-green-700 bg-green-50",
    UPDATE: "text-amber-700 bg-amber-50",
    SKIP: "text-gray-500 bg-gray-50",
  };
  const entityIcon: Record<string, string> = { CLIENT: "👤", SESSION: "📅", PACK: "🎟️" };

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">Detalle ({items.length} elementos)</p>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Entidad</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Acción</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">ID Harbiz</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.slice(0, 50).map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-1.5">{entityIcon[item.entity]} {item.entity}</td>
                <td className="px-3 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${actionColor[item.action]}`}>
                    {item.action}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono text-gray-400">{item.harbizId.slice(0, 8)}…</td>
                <td className="px-3 py-1.5 text-gray-500">{item.reason ?? item.entityLabel}</td>
              </tr>
            ))}
            {items.length > 50 && (
              <tr>
                <td colSpan={4} className="px-3 py-2 text-center text-gray-400">
                  …y {items.length - 50} más
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentLogs({ logs }: { logs: SyncLogEntry[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Historial de syncs</h2>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center gap-3 text-sm py-2 border-b border-gray-100 last:border-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === "COMPLETED" ? "bg-green-400" : log.status === "FAILED" ? "bg-red-400" : "bg-blue-400"}`} />
            <span className="text-gray-500 text-xs w-36 flex-shrink-0">{new Date(log.startedAt).toLocaleString("es-ES")}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${log.dryRun ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}>
              {log.dryRun ? "dry-run" : "real"}
            </span>
            <span className="text-gray-700 text-xs flex-1">
              {log.clientsFound} clientes · {log.sessionsFound} sesiones · {log.packsFound} bonos
            </span>
            {log.errors && Array.isArray(log.errors) && log.errors.length > 0 && (
              <span className="text-red-500 text-xs">{log.errors.length} error(es)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 animate-pulse">Cargando…</div>
    </div>
  );
}
