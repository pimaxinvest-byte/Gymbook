import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/telegram/send-test
 * Sends a test message to a specific Telegram chat ID.
 * Body: { chatId: string, message: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { chatId?: string; message?: string };
  const { chatId, message } = body;

  if (!chatId?.trim()) {
    return NextResponse.json({ error: "Chat ID requerido" }, { status: 400 });
  }

  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken) {
    return NextResponse.json({ error: "Bot de Telegram no configurado" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: message || "Mensaje de prueba desde GymBook",
        }),
      }
    );
    const data = await res.json();
    if (data.ok) return NextResponse.json({ success: true });
    return NextResponse.json({ error: data.description || "Error de Telegram" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
