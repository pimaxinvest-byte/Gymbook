"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, Clock } from "lucide-react";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"pending" | "active" | null>(null);
  const [accepted, setAccepted] = useState(false);

  const [form, setForm] = useState({
    name:             "",
    lastName:         "",
    email:            "",
    password:         "",
    phone:            "",
    telegramUsername: "",
    goals:            "",
  });

  const errors: Record<string, string> = {};

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name || form.name.length < 2) { setError("El nombre debe tener al menos 2 caracteres"); return; }
    if (!form.email || !form.email.includes("@")) { setError("Email inválido"); return; }
    if (!form.password || form.password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (!accepted) { setError("Debes aceptar las condiciones"); return; }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, acceptedTerms: accepted }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Error al registrarse");
      setLoading(false);
    } else {
      setDone(json.status === "active" ? "active" : "pending");
    }
  }

  // Success state
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 text-center">
          {done === "active" ? (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Cuenta creada!</h2>
              <p className="text-gray-500 mb-6">Tu cuenta está activa. Ya puedes iniciar sesión.</p>
              <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
                Iniciar sesión
              </Button>
            </>
          ) : (
            <>
              <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Solicitud enviada</h2>
              <p className="text-gray-500 mb-2">
                Tu solicitud está pendiente de aprobación por el administrador.
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Recibirás un mensaje de Telegram o email cuando tu cuenta esté activa.
              </p>
              <Button size="lg" variant="outline" className="w-full" onClick={() => router.push("/login")}>
                Volver al inicio
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="mb-3 drop-shadow-2xl">
            <Image src="/logo.svg" alt="GymBook Logo" width={80} height={80} priority />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">GymBook</h1>
          <p className="text-sm text-gray-500 mt-1">Crear nueva cuenta</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nombre *"
                placeholder="Ana"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={errors.name}
              />
              <Input
                label="Apellido"
                placeholder="García"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>

            <Input
              label="Email *"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
            />

            <Input
              label="Contraseña *"
              type="password"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              error={errors.password}
            />

            <Input
              label="Teléfono"
              type="tel"
              placeholder="+34 600 000 000"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />

            <Input
              label="Telegram (usuario, ej: @miusuario)"
              placeholder="@usuario (opcional)"
              value={form.telegramUsername}
              onChange={(e) => setForm((f) => ({ ...f, telegramUsername: e.target.value }))}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Objetivo / Actividad de interés
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Pérdida de peso, Yoga, Entrenamiento personal..."
                value={form.goals}
                onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none resize-none"
              />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600">
                Acepto las{" "}
                <span className="text-orange-600 font-semibold">condiciones de uso</span>{" "}
                y el tratamiento de mis datos.
              </span>
            </label>

            {error && (
              <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Solicitar acceso"}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="text-orange-600 font-semibold">Inicia sesión</a>
          </p>
        </div>
      </div>
    </div>
  );
}
