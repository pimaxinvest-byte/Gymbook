import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken || !settings?.adminChatId) {
    return NextResponse.json({ error: "Bot token y Admin Chat ID son necesarios" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.adminChatId,
          text: "✅ <b>GymBook — Test de conexión exitoso</b>\n\nTu bot de Telegram está correctamente configurado.",
          parse_mode: "HTML",
        }),
      }
    );
    const data = await res.json();
    if (data.ok) return NextResponse.json({ success: true });
    return NextResponse.json({ error: data.description }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
