"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ShieldOff, RefreshCw, AlertTriangle, CheckCircle2, Info } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Permission {
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
}

interface FieldMapping {
  entity: string;
  harbizField: string;
  gymField: string;
  description: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  action: string;
}

interface PreviewData {
  lastDryRun: {
    clientsFound: number;
    clientsCreated: number;
    clientsUpdated: number;
    sessionsFound: number;
    sessionsCreated: number;
    packsFound: number;
    packsCreated: number;
    startedAt: string;
  } | null;
  fieldMappings: FieldMapping[];
  warnings: string[];
}

interface SyncResult {
  status: string;
  created?: number;
  skipped?: number;
  errors?: string[];
  clients?: { found: number; toCreate: number; toUpdate: number; skipped: number };
  sessions?: { found: number; toCreate: number; skipped: number };
  packs?: { found: number; toCreate: number };
  dryRun?: boolean;
}

// ─── Risk badge ──────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, string> = {
  LOW:    "bg-green-50 text-green-700",
  MEDIUM: "bg-amber-50  text-amber-700",
  HIGH:   "bg-red-50   text-red-700",
};

const ACTION_STYLE: Record<string, string> = {
  CREATE:   "bg-blue-50   text-blue-700",
  UPSERT:   "bg-purple-50 text-purple-700",
  DEFAULT:  "bg-gray-50   text-gray-600",
  SET_ONCE: "bg-orange-50 text-orange-700",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function TeacherImportPage() {
  const [permission, setPermission] = useState<Permission | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPerm, setLoadingPerm] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load permission status on mount
  useEffect(() => {
    (async () => {
      setLoadingPerm(true);
      const res = await fetch("/api/harbiz/permission");
      if (res.ok) setPermission(await res.json());
      setLoadingPerm(false);
    })();
  }, []);

  // Load field preview
  async function loadPreview() {
    setLoadingPreview(true);
    const res = await fetch("/api/harbiz/preview");
    if (res.ok) setPreview(await res.json());
    setLoadingPreview(false);
    setShowPreview(true);
  }

  // Grant consent
  async function grantPermission() {
    const res = await fetch("/api/harbiz/permission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) setPermission(await res.json());
  }

  // Revoke consent
  async function revokePermission() {
    if (!confirm("¿Revocar el consentimiento de importación? No se borrarán datos ya importados.")) return;
    const res = await fetch("/api/harbiz/permission", { method: "DELETE" });
    if (res.ok) setPermission({ granted: false, grantedAt: null, revokedAt: new Date().toISOString() });
  }

  // Run dry-run then confirm
  async function runDryRun() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/harbiz/sync?dryRun=true", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setSyncResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function runRealSync() {
    if (!confirm("¿Confirmar importación real? Se crearán clientes, sesiones y bonos en GymBook.")) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/harbiz/sync?dryRun=false", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setSyncResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  if (loadingPerm) return (
    <AppShell title="Importar desde Harbiz">
      <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>
    </AppShell>
  );

  return (
    <AppShell title="Importar desde Harbiz">
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* ── CONSENT GATE ── */}
        {!permission?.granted ? (
          <ConsentGate onGrant={grantPermission} />
        ) : (
          <>
            {/* Permission status bar */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Consentimiento activo</p>
                  {permission.grantedAt && (
                    <p className="text-xs text-green-600">Concedido el {new Date(permission.grantedAt).toLocaleString("es-ES")}</p>
                  )}
                </div>
              </div>
              <button onClick={revokePermission} className="text-xs text-red-500 hover:underline flex items-center gap-1 cursor-pointer">
                <ShieldOff className="h-3.5 w-3.5" /> Revocar
              </button>
            </div>

            {/* Field preview toggle */}
            <div>
              <button
                onClick={showPreview ? () => setShowPreview(false) : loadPreview}
                className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Info className="h-4 w-4" />
                {showPreview ? "Ocultar campos importados" : "Ver qué campos se importan →"}
              </button>
            </div>

            {/* Field preview table */}
            {showPreview && (
              <FieldPreviewCard data={preview} loading={loadingPreview} />
            )}

            {/* Action buttons */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-gray-900">Importar datos</h2>
              <p className="text-sm text-gray-500">
                Primero usa <strong>Previsualizar</strong> para ver qué se importará sin modificar nada.
                Luego confirma si todo es correcto.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={runDryRun} disabled={syncing} variant="outline" size="sm">
                  {syncing && !syncResult ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Previsualizar
                </Button>
                {syncResult?.dryRun === true && (
                  <Button onClick={runRealSync} disabled={syncing} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Confirmar importación
                  </Button>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Sync result */}
            {syncResult && <SyncResultCard result={syncResult} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ─── Consent Gate ────────────────────────────────────────────────────────────

function ConsentGate({ onGrant }: { onGrant: () => void }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="bg-white border-2 border-orange-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-orange-400 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-gray-900">Consentimiento de importación</h2>
          <p className="text-sm text-gray-500">Antes de importar necesitamos tu permiso explícito</p>
        </div>
      </div>

      <div className="bg-orange-50 rounded-xl p-4 space-y-2 text-sm text-orange-900">
        <p className="font-semibold">¿Qué datos se importarán desde Harbiz?</p>
        <ul className="list-disc list-inside space-y-1 text-orange-800">
          <li>Clientes: nombre, email y teléfono</li>
          <li>Sesiones futuras: fecha, hora y duración</li>
          <li>Bonos: créditos disponibles por cliente</li>
        </ul>
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p>✅ Harbiz se accede en <strong>modo solo lectura</strong> — no se modifica ningún dato.</p>
        <p>✅ Los datos importados quedan almacenados en GymBook bajo tu responsabilidad.</p>
        <p>✅ Puedes revocar este consentimiento en cualquier momento desde esta página.</p>
        <p>⚠️ Los emails se usan como clave de identificación de clientes.</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-orange-500"
        />
        <span className="text-sm text-gray-700">
          He leído y acepto que GymBook importe los datos indicados desde mi cuenta de Harbiz.
          Entiendo que actúo como responsable de estos datos.
        </span>
      </label>

      <Button onClick={onGrant} disabled={!accepted} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
        <ShieldCheck className="h-4 w-4" />
        Autorizar importación
      </Button>
    </div>
  );
}

// ─── Field Preview Card ───────────────────────────────────────────────────────

function FieldPreviewCard({ data, loading }: { data: PreviewData | null; loading: boolean }) {
  if (loading) return (
    <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>
  );
  if (!data) return null;

  const entities = [...new Set(data.fieldMappings.map(f => f.entity))];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm">Campos que se importan</h3>

      {/* Last dry-run summary */}
      {data.lastDryRun && (
        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          <span className="font-semibold">Último previsualizado:</span>{" "}
          {new Date(data.lastDryRun.startedAt).toLocaleString("es-ES")} —{" "}
          {data.lastDryRun.clientsFound} clientes · {data.lastDryRun.sessionsFound} sesiones · {data.lastDryRun.packsFound} bonos
        </div>
      )}

      {/* Field mapping table by entity */}
      {entities.map(entity => (
        <div key={entity}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{entity}</p>
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Campo Harbiz</th>
                  <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Campo GymBook</th>
                  <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Acción</th>
                  <th className="text-left px-3 py-1.5 text-gray-400 font-medium">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.fieldMappings.filter(f => f.entity === entity).map((f, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono text-gray-600">{f.harbizField}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-500">{f.gymField}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ACTION_STYLE[f.action] ?? "bg-gray-50 text-gray-600"}`}>
                        {f.action}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${RISK_STYLE[f.risk]}`}>
                        {f.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-1">
          {data.warnings.map((w, i) => (
            <div key={i} className="flex gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sync Result Card ─────────────────────────────────────────────────────────

function SyncResultCard({ result }: { result: SyncResult }) {
  const isReal = result.dryRun === false;
  return (
    <div className={`rounded-xl border-2 p-5 space-y-3 ${isReal ? "border-green-300 bg-green-50" : "border-blue-200 bg-blue-50"}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isReal ? "bg-green-200 text-green-800" : "bg-blue-200 text-blue-800"}`}>
          {isReal ? "SYNC REAL" : "PREVISUALIZACIÓN"}
        </span>
        <span className="text-xs font-semibold text-gray-700">{result.status}</span>
      </div>

      {result.clients && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <StatMini label="Clientes" value={result.clients.found} note={`+${result.clients.toCreate} nuevos`} />
          <StatMini label="Sesiones" value={result.sessions?.found ?? 0} note={`+${result.sessions?.toCreate ?? 0} nuevas`} />
          <StatMini label="Bonos" value={result.packs?.found ?? 0} note={`+${result.packs?.toCreate ?? 0} nuevos`} />
        </div>
      )}

      {result.errors && result.errors.length > 0 && (
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Errores ({result.errors.length})</p>
          <ul className="text-xs text-red-600 space-y-0.5">
            {result.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
            {result.errors.length > 5 && <li>…y {result.errors.length - 5} más</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatMini({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="bg-white rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-green-600 font-medium">{note}</p>
    </div>
  );
}
