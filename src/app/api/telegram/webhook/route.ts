/**
 * POST /api/telegram/webhook
 * Handles all incoming Telegram bot messages & commands.
 *
 * Commands:
 *   /start user_<userId>_<token> — link account
 *   /reservas                   — list upcoming bookings
 *   /cancelar                   — cancel a booking
 *   /checkin                    — check in to a session
 *   /creditos                   — view credit balance
 *   /espera                     — waitlist position
 *   /ayuda                      — help
 *
 * Set up webhook:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PROD_URL>/api/telegram/webhook
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TGChat = { id: number; username?: string; first_name?: string };

interface TelegramUpdate {
  message?: {
    message_id: number;
    chat:  TGChat;
    from?: TGChat;
    text?: string;
  };
  callback_query?: {
    id:      string;
    from:    TGChat;
    data?:   string;
    message?: { message_id: number; chat: TGChat };
  };
}

async function sendMsg(botToken: string, chatId: number | string, text: string, extra?: object) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  }).catch(console.error);
}

async function answerCallback(botToken: string, callbackId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ callback_query_id: callbackId, text }),
  }).catch(console.error);
}

function formatDT(dt: Date) {
  return dt.toLocaleString("es-ES", {
    weekday: "short", day: "2-digit", month: "2-digit",
    hour:    "2-digit", minute: "2-digit",
  });
}

export async function POST(req: NextRequest) {
  const settings = await prisma.telegramSettings.findFirst();
  const botToken = settings?.botToken || process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) return NextResponse.json({ ok: true });

  const update: TelegramUpdate = await req.json().catch(() => ({}));

  // ── Callback queries (inline button taps) ────────────────────
  if (update.callback_query) {
    const cb    = update.callback_query;
    const chatId = cb.from.id;
    const data  = cb.data || "";

    // confirm_cancel:<bookingId>
    if (data.startsWith("confirm_cancel:")) {
      const bookingId = data.slice("confirm_cancel:".length);
      const user = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) } });
      if (!user) { await answerCallback(botToken, cb.id, "Cuenta no vinculada"); return NextResponse.json({ ok: true }); }

      const client = await prisma.client.findUnique({ where: { userId: user.id } });
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, clientId: client?.id, status: "BOOKED" },
        include: { activity: true, space: true, teacher: { include: { user: { select: { name: true, telegramChatId: true } } } } },
      });

      if (!booking) {
        await answerCallback(botToken, cb.id, "Reserva no encontrada");
      } else {
        await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
        await answerCallback(botToken, cb.id, "Reserva cancelada");
        await sendMsg(botToken, chatId,
          `❌ Reserva cancelada:\n📅 ${formatDT(booking.startDatetime)}\n🏃 ${booking.activity.name}`
        );
        // Notify teacher
        if (booking.teacher.user.telegramChatId) {
          await sendMsg(botToken, booking.teacher.user.telegramChatId,
            `❌ <b>${user.name}</b> ha cancelado su sesión:\n📅 ${formatDT(booking.startDatetime)}\n🏃 ${booking.activity.name}\n📍 ${booking.space.name}`
          );
        }
      }
    }

    // confirm_checkin:<bookingId>
    if (data.startsWith("confirm_checkin:")) {
      const bookingId = data.slice("confirm_checkin:".length);
      const user = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) } });
      if (!user) { await answerCallback(botToken, cb.id, "Cuenta no vinculada"); return NextResponse.json({ ok: true }); }

      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, status: "BOOKED" },
        include: { activity: true, teacher: { include: { user: { select: { name: true, telegramChatId: true } } } } },
      });

      if (!booking) {
        await answerCallback(botToken, cb.id, "Reserva no encontrada");
      } else {
        await answerCallback(botToken, cb.id, "✅ Check-in realizado");
        await sendMsg(botToken, chatId, `✅ <b>Check-in confirmado</b>\n🏃 ${booking.activity.name}\n📅 ${formatDT(booking.startDatetime)}`);
        if (booking.teacher.user.telegramChatId) {
          await sendMsg(botToken, booking.teacher.user.telegramChatId,
            `✅ <b>Check-in:</b> ${user.name}\n🏃 ${booking.activity.name}\n📅 ${formatDT(booking.startDatetime)}`
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ── Text messages ─────────────────────────────────────────────
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true });

  const chatId   = msg.chat.id;
  const username = msg.from?.username || msg.chat.username;
  const text     = msg.text.trim();

  // ── /start user_<userId>_<token> — Link account ───────────────
  if (text.startsWith("/start")) {
    const payload = text.slice("/start".length).trim();

    if (payload.startsWith("user_")) {
      const parts = payload.split("_");
      // "user_<cuid>_<48hexchars>"  →  parts[0]="user", parts[1]=userId, parts[2..]=token
      const userId = parts[1];
      const token  = parts.slice(2).join("_");

      if (!userId || !token) {
        await sendMsg(botToken, chatId, "❌ Enlace inválido. Solicita uno nuevo.");
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findFirst({ where: { id: userId, telegramToken: token } });
      if (!user) {
        await sendMsg(botToken, chatId, "❌ El enlace ha expirado. Solicita uno nuevo desde la app.");
        return NextResponse.json({ ok: true });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          telegramChatId:    String(chatId),
          telegramUsername:  username ? `@${username}` : undefined,
          telegramConnected: true,
          telegramToken:     null,
        },
      });

      await sendMsg(botToken, chatId,
        `✅ <b>¡Telegram conectado!</b>\n\nHola ${user.name} 👋\nYa recibirás notificaciones de tus reservas aquí.\n\nEscribe /ayuda para ver los comandos disponibles.`
      );

      if (settings?.notifyAdmin && settings.adminChatId) {
        await sendMsg(botToken, settings.adminChatId,
          `🔗 <b>${user.name}</b> ha conectado Telegram${username ? ` (@${username})` : ""}`
        );
      }
    } else {
      // Generic /start without payload
      await sendMsg(botToken, chatId,
        `👋 <b>Bienvenido/a a GymBook!</b>\n\nPara conectar tu cuenta, usa el enlace del panel de la app.\n\nComandos disponibles:\n/ayuda — Ver todos los comandos`
      );
    }
    return NextResponse.json({ ok: true });
  }

  // For all other commands, require a linked account
  const user = await prisma.user.findFirst({ where: { telegramChatId: String(chatId) } });

  if (!user) {
    await sendMsg(botToken, chatId,
      "⚠️ Tu cuenta de Telegram no está vinculada.\n\nUsa el enlace del panel de GymBook para conectarla."
    );
    return NextResponse.json({ ok: true });
  }

  // ── /reservas — upcoming bookings ────────────────────────────
  if (text.startsWith("/reservas")) {
    const client = await prisma.client.findUnique({ where: { userId: user.id } });
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });

    let bookings: Array<{
      startDatetime: Date; endDatetime: Date;
      activity: { name: string }; space: { name: string };
      teacher?: { user: { name: string } } | null;
      client?:  { user: { name: string } } | null;
    }> = [];
    if (client) {
      bookings = await prisma.booking.findMany({
        where: {
          clientId: client.id,
          status: "BOOKED",
          startDatetime: { gte: new Date() },
        },
        include: { activity: true, space: true, teacher: { include: { user: { select: { name: true } } } } },
        orderBy: { startDatetime: "asc" },
        take: 5,
      });
    } else if (teacher) {
      bookings = await prisma.booking.findMany({
        where: {
          teacherId: teacher.id,
          status: { in: ["BOOKED", "AVAILABLE"] },
          startDatetime: { gte: new Date() },
        },
        include: { activity: true, space: true, client: { include: { user: { select: { name: true } } } } },
        orderBy: { startDatetime: "asc" },
        take: 5,
      });
    } else {
      bookings = [];
    }

    if (bookings.length === 0) {
      await sendMsg(botToken, chatId, "📅 No tienes reservas próximas.");
    } else {
      const lines = bookings.map((b, i) => {
        const dt = formatDT(b.startDatetime);
        const extra = teacher
          ? (b as typeof b & { client?: { user: { name: string } } | null }).client?.user.name || "Disponible"
          : b.teacher?.user.name;
        return `${i + 1}. 📅 ${dt}\n   🏃 ${b.activity.name} · 📍 ${b.space.name}${extra ? `\n   👤 ${extra}` : ""}`;
      }).join("\n\n");

      await sendMsg(botToken, chatId, `📅 <b>Tus próximas sesiones:</b>\n\n${lines}`);
    }
    return NextResponse.json({ ok: true });
  }

  // ── /cancelar — cancel booking ────────────────────────────────
  if (text.startsWith("/cancelar")) {
    const client = await prisma.client.findUnique({ where: { userId: user.id } });
    if (!client) { await sendMsg(botToken, chatId, "Solo los clientes pueden cancelar reservas."); return NextResponse.json({ ok: true }); }

    const bookings = await prisma.booking.findMany({
      where: { clientId: client.id, status: "BOOKED", startDatetime: { gte: new Date() } },
      include: { activity: true, space: true },
      orderBy: { startDatetime: "asc" },
      take: 5,
    });

    if (bookings.length === 0) {
      await sendMsg(botToken, chatId, "No tienes reservas que cancelar.");
    } else {
      const inlineKeyboard = bookings.map((b) => [{
        text:          `❌ ${formatDT(b.startDatetime)} — ${b.activity.name}`,
        callback_data: `confirm_cancel:${b.id}`,
      }]);
      await sendMsg(botToken, chatId, "¿Qué reserva quieres cancelar?", {
        reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard }),
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ── /checkin — check in ───────────────────────────────────────
  if (text.startsWith("/checkin")) {
    const client = await prisma.client.findUnique({ where: { userId: user.id } });
    if (!client) { await sendMsg(botToken, chatId, "Solo los clientes pueden hacer check-in."); return NextResponse.json({ ok: true }); }

    const now = new Date();
    const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000); // next 2 hours

    const bookings = await prisma.booking.findMany({
      where: { clientId: client.id, status: "BOOKED", startDatetime: { gte: now, lte: soon } },
      include: { activity: true },
      orderBy: { startDatetime: "asc" },
    });

    if (bookings.length === 0) {
      await sendMsg(botToken, chatId, "No tienes sesiones en las próximas 2 horas para hacer check-in.");
    } else {
      const inlineKeyboard = bookings.map((b) => [{
        text:          `✅ ${formatDT(b.startDatetime)} — ${b.activity.name}`,
        callback_data: `confirm_checkin:${b.id}`,
      }]);
      await sendMsg(botToken, chatId, "¿En qué sesión quieres hacer check-in?", {
        reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard }),
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ── /creditos — credit balance ────────────────────────────────
  if (text.startsWith("/creditos")) {
    const client = await prisma.client.findUnique({ where: { userId: user.id } });
    if (!client) { await sendMsg(botToken, chatId, "Los profesores no usan créditos."); return NextResponse.json({ ok: true }); }

    const credits = await prisma.clientCredits.findMany({
      where: { clientId: client.id },
      include: { teacher: { include: { user: { select: { name: true } } } } },
    });

    if (credits.length === 0) {
      await sendMsg(botToken, chatId, "💳 No tienes créditos asignados. Habla con tu entrenador.");
    } else {
      const lines = credits.map((c) =>
        `👤 <b>${c.teacher.user.name}</b> — ${c.creditType === "SGT" ? "SGT" : "Individual"}: <b>${c.balance} crédito${c.balance !== 1 ? "s" : ""}</b>${c.expiresAt ? `\n   Expiran: ${c.expiresAt.toLocaleDateString("es-ES")}` : ""}`
      ).join("\n\n");
      await sendMsg(botToken, chatId, `💳 <b>Tus créditos:</b>\n\n${lines}`);
    }
    return NextResponse.json({ ok: true });
  }

  // ── /espera — waitlist ────────────────────────────────────────
  if (text.startsWith("/espera")) {
    const client = await prisma.client.findUnique({ where: { userId: user.id } });
    if (!client) { await sendMsg(botToken, chatId, "Solo los clientes pueden ver la lista de espera."); return NextResponse.json({ ok: true }); }

    const entries = await prisma.waitlistEntry.findMany({
      where: { clientId: client.id, booking: { startDatetime: { gte: new Date() } } },
      include: { booking: { include: { activity: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (entries.length === 0) {
      await sendMsg(botToken, chatId, "No estás en ninguna lista de espera.");
    } else {
      const lines = entries.map((e) =>
        `📋 Posición #${e.position} — ${e.booking.activity.name}\n   📅 ${formatDT(e.booking.startDatetime)}`
      ).join("\n\n");
      await sendMsg(botToken, chatId, `⏳ <b>Lista de espera:</b>\n\n${lines}`);
    }
    return NextResponse.json({ ok: true });
  }

  // ── /ayuda — help ─────────────────────────────────────────────
  if (text.startsWith("/ayuda") || text.startsWith("/help") || text.startsWith("/start")) {
    await sendMsg(botToken, chatId,
      `🏋️ <b>GymBook Bot — Comandos</b>\n\n` +
      `/reservas — Ver tus próximas sesiones\n` +
      `/cancelar — Cancelar una reserva\n` +
      `/checkin  — Confirmar asistencia (2h antes)\n` +
      `/creditos — Ver tus créditos\n` +
      `/espera   — Ver lista de espera\n` +
      `/ayuda    — Mostrar esta ayuda\n\n` +
      `💡 Para conectar tu cuenta, usa el enlace del panel de GymBook.`
    );
    return NextResponse.json({ ok: true });
  }

  // Unknown message
  await sendMsg(botToken, chatId, "No entiendo ese comando. Escribe /ayuda para ver los disponibles.");
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, bot: "Daddysgymbook_bot", info: "GymBook Telegram Webhook active" });
}
