"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { Copy, Check, Mail, ExternalLink, Users } from "lucide-react";

const REGISTER_URL = "https://gymbook-app-production.up.railway.app/register";

const DEFAULT_MESSAGE = `¡Hola! Te invitamos a unirte a GymBook, la app de reservas de nuestro gimnasio.

Reserva sesiones con tu entrenador personal, gestiona tus créditos y horarios, y recibe notificaciones en Telegram.

Regístrate aquí: ${REGISTER_URL}

¡Te esperamos!`;

export default function InvitePage() {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(REGISTER_URL).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      toast({ title: "Enlace copiado", variant: "success" });
    });
  }

  function copyMessage() {
    navigator.clipboard.writeText(message).then(() => {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
      toast({ title: "Mensaje copiado", variant: "success" });
    });
  }

  function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: "GymBook — Reservas de gimnasio",
        text: message,
        url: REGISTER_URL,
      }).catch(() => {});
    }
  }

  const encodedMessage = encodeURIComponent(message);

  return (
    <AppShell title="Invitar clientes">
      <div className="p-4 max-w-xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Invitar nuevos clientes</h1>
            <p className="text-xs text-gray-500">Comparte el enlace de registro con tus clientes</p>
          </div>
        </div>

        {/* Registration link */}
        <Card>
          <CardHeader>
            <CardTitle>Enlace de registro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 break-all">
                {REGISTER_URL}
              </p>
              <button
                onClick={copyLink}
                aria-label="Copiar enlace"
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Editable message */}
        <Card>
          <CardHeader>
            <CardTitle>Mensaje predefinido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none text-gray-700 leading-relaxed"
            />
            <p className="text-xs text-gray-400">Puedes editar el mensaje antes de compartirlo.</p>
          </CardContent>
        </Card>

        {/* Share buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Compartir por</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {/* Email */}
              <a
                href={`mailto:?subject=${encodeURIComponent("Invitación GymBook")}&body=${encodedMessage}`}
                className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-600 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Email
              </a>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodedMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-green-200 bg-green-50 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                WhatsApp
              </a>

              {/* Copy message */}
              <Button
                size="lg"
                variant="outline"
                onClick={copyMessage}
                className="flex items-center gap-2"
              >
                {copiedMsg ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copiar texto
              </Button>

              {/* Native share (mobile) */}
              {typeof navigator !== "undefined" && "share" in navigator ? (
                <Button
                  size="lg"
                  onClick={handleNativeShare}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Compartir
                </Button>
              ) : (
                <a
                  href={`https://wa.me/?text=${encodedMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-12 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Más opciones
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
