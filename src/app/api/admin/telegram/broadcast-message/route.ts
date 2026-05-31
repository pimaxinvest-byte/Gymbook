import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * POST /api/admin/telegram/broadcast-message
 * Sends a custom text message to all users with telegramChatId matching the given roles.
 * Body: { message: string, roles: ("TEACHER" | "CLIENT" | "ADMIN")[] }
 * Returns: { sent: number, errors: number }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { message?: string; roles?: Role[] };
  const { message, roles } = body;

  if (!message || !message.trim()) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
  }
  if (!roles || roles.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos un rol destinatario" }, { status: 400 });
  }

  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken) {
    return NextResponse.json({ error: "Bot de Telegram no configurado" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: {
      role: { in: roles },
      telegramChatId: { not: null },
    },
    select: { id: true, name: true, telegramChatId: true },
  });

  let sent = 0;
  let errors = 0;

  for (const u of users) {
    if (!u.telegramChatId) continue;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: u.telegramChatId,
            text: message,
          }),
        }
      );
      if (res.ok) sent++;
      else errors++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ sent, errors });
}
