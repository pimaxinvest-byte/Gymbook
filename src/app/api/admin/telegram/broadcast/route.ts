import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/telegram/broadcast
 * Sends messages to teachers:
 *  - Connected teachers  → receive the Quick Start PDF link
 *  - Unconnected teachers → receive nothing (deep links are generated client-side)
 *
 * Returns { sent: string[], pending: string[], errors: string[] }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type = "pdf" } = await req.json().catch(() => ({})) as { type?: string };

  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken) {
    return NextResponse.json({ error: "Bot de Telegram no configurado" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://gymbook-app-production.up.railway.app";

  // Fetch all teachers
  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { name: true, telegramChatId: true, telegramConnected: true } } },
  });

  const sent: string[] = [];
  const pending: string[] = [];
  const errors: string[] = [];

  for (const t of teachers) {
    if (!t.user.telegramChatId) {
      pending.push(t.user.name);
      continue;
    }

    try {
      if (type === "pdf") {
        // Send PDF link
        const pdfUrl = `${baseUrl}/GymBook-QuickStart.pdf`;
        const text = [
          `📚 <b>GymBook — Guía de Inicio Rápido</b>`,
          ``,
          `Hola ${t.user.name.split(" ")[0]}! Aquí tienes la guía completa de GymBook.`,
          ``,
          `📎 <a href="${pdfUrl}">Descargar Guía PDF</a>`,
          ``,
          `🌐 App: <a href="${baseUrl}">${baseUrl.replace("https://", "")}</a>`,
          ``,
          `¿Preguntas? Escribe /ayuda en este chat.`,
        ].join("\n");

        const res = await fetch(
          `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: t.user.telegramChatId,
              text,
              parse_mode: "HTML",
              disable_web_page_preview: false,
            }),
          }
        );
        if (res.ok) sent.push(t.user.name);
        else {
          const err = await res.json();
          errors.push(`${t.user.name}: ${err.description || "error"}`);
        }
      } else {
        // Send generic notification
        const text = `👋 Hola ${t.user.name.split(" ")[0]}! Mensaje desde GymBook.`;
        const res = await fetch(
          `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: t.user.telegramChatId, text }),
          }
        );
        if (res.ok) sent.push(t.user.name);
        else errors.push(`${t.user.name}: error`);
      }
    } catch (e) {
      errors.push(`${t.user.name}: ${String(e)}`);
    }
  }

  return NextResponse.json({ sent, pending, errors });
}

/**
 * GET /api/admin/telegram/broadcast
 * Returns Telegram connection status for all teachers.
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teachers = await prisma.teacher.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          telegramChatId: true,
          telegramConnected: true,
          telegramUsername: true,
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(
    teachers.map((t) => ({
      teacherId: t.id,
      userId: t.user.id,
      name: t.user.name,
      email: t.user.email,
      telegramConnected: t.user.telegramConnected,
      telegramUsername: t.user.telegramUsername,
      hasChatId: !!t.user.telegramChatId,
    }))
  );
}
