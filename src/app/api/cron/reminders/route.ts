import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/reminders
 * Sends 24h and 1h Telegram reminders for upcoming BOOKED sessions.
 * Run every 30 min via Railway cron or external scheduler.
 * Protect with CRON_SECRET env var (passed as ?secret= or x-cron-secret header).
 */
export async function GET(req: NextRequest) {
  const secret   = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ??
                   new URL(req.url).searchParams.get("secret");

  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken) {
    return NextResponse.json({ skipped: "No bot token configured" });
  }

  const token = settings.botToken;
  const now   = new Date();

  // 24h window: sessions starting in [23.5h … 24.5h]
  const w24s = new Date(now.getTime() + 23.5 * 3600_000);
  const w24e = new Date(now.getTime() + 24.5 * 3600_000);

  // 1h window: sessions starting in [50min … 70min]
  const w1s  = new Date(now.getTime() + 50 * 60_000);
  const w1e  = new Date(now.getTime() + 70 * 60_000);

  const include = {
    teacher:      { include: { user: { select: { name: true, telegramChatId: true } } } },
    client:       { include: { user: { select: { name: true, telegramChatId: true } } } },
    activity:     { select: { name: true } },
    space:        { select: { name: true } },
    participants: { include: { client: { include: { user: { select: { name: true, telegramChatId: true } } } } } },
  } as const;

  const [b24, b1] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: "BOOKED",
        startDatetime: { gte: w24s, lte: w24e },
        notifications: { none: { type: "reminder_24h" } },
      },
      include,
    }),
    prisma.booking.findMany({
      where: {
        status: "BOOKED",
        startDatetime: { gte: w1s, lte: w1e },
        notifications: { none: { type: "reminder_1h" } },
      },
      include,
    }),
  ]);

  async function send(chatId: string, text: string): Promise<boolean> {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
      return (await r.json()).ok === true;
    } catch { return false; }
  }

  function fmt(d: Date, opts: Intl.DateTimeFormatOptions) {
    return d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", ...opts });
  }

  const results = { sent24h: 0, sent1h: 0, errors: 0 };

  // ── 24h reminders ────────────────────────────────────────────────────────
  for (const b of b24) {
    const dateStr = fmt(b.startDatetime, { weekday: "long", day: "numeric", month: "long" });
    const timeStr = fmt(b.startDatetime, { hour: "2-digit", minute: "2-digit" });

    const forTeacher =
      `⏰ <b>Recordatorio — mañana</b>\n\n` +
      `🏃 ${b.activity.name} · ${timeStr}\n` +
      `📍 ${b.space.name}\n` +
      (b.client ? `👤 ${b.client.user.name}` : `👥 Grupo (${b.participants.length}/${b.capacity})`);

    const forClient =
      `⏰ <b>Recordatorio — mañana tienes sesión</b>\n\n` +
      `🏃 ${b.activity.name} con ${b.teacher.user.name}\n` +
      `📅 ${dateStr} a las ${timeStr}\n` +
      `📍 ${b.space.name}\n\n` +
      `Escribe /checkin cuando llegues 💪`;

    type Entry = { chatId: string; role: "teacher" | "client"; msg: string };
    const targets: Entry[] = [];

    if (b.teacher.user.telegramChatId)
      targets.push({ chatId: b.teacher.user.telegramChatId, role: "teacher", msg: forTeacher });
    if (b.client?.user.telegramChatId)
      targets.push({ chatId: b.client.user.telegramChatId, role: "client", msg: forClient });
    for (const p of b.participants) {
      if (p.client.user.telegramChatId)
        targets.push({ chatId: p.client.user.telegramChatId, role: "client", msg: forClient });
    }

    for (const { chatId, role, msg } of targets) {
      const ok = await send(chatId, msg);
      if (ok) results.sent24h++; else results.errors++;
      await prisma.notificationLog.create({
        data: { bookingId: b.id, type: "reminder_24h", recipient: role, message: msg, success: ok },
      }).catch(() => {});
    }
  }

  // ── 1h reminders ─────────────────────────────────────────────────────────
  for (const b of b1) {
    const timeStr = fmt(b.startDatetime, { hour: "2-digit", minute: "2-digit" });

    const forTeacher =
      `🔔 <b>En 1 hora — ${b.activity.name}</b>\n` +
      `📍 ${b.space.name} · ${timeStr}\n` +
      (b.client ? `👤 ${b.client.user.name}` : `👥 Grupo (${b.participants.length}/${b.capacity})`);

    const forClient =
      `🔔 <b>En 1 hora tienes sesión</b>\n\n` +
      `🏃 ${b.activity.name} con ${b.teacher.user.name}\n` +
      `⏰ ${timeStr} · 📍 ${b.space.name}\n\n` +
      `¡Hasta ahora! Haz /checkin cuando llegues.`;

    type Entry = { chatId: string; role: "teacher" | "client"; msg: string };
    const targets: Entry[] = [];

    if (b.teacher.user.telegramChatId)
      targets.push({ chatId: b.teacher.user.telegramChatId, role: "teacher", msg: forTeacher });
    if (b.client?.user.telegramChatId)
      targets.push({ chatId: b.client.user.telegramChatId, role: "client", msg: forClient });
    for (const p of b.participants) {
      if (p.client.user.telegramChatId)
        targets.push({ chatId: p.client.user.telegramChatId, role: "client", msg: forClient });
    }

    for (const { chatId, role, msg } of targets) {
      const ok = await send(chatId, msg);
      if (ok) results.sent1h++; else results.errors++;
      await prisma.notificationLog.create({
        data: { bookingId: b.id, type: "reminder_1h", recipient: role, message: msg, success: ok },
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    ok: true,
    checked: { h24: b24.length, h1: b1.length },
    ...results,
    ts: now.toISOString(),
  });
}
