import { prisma } from "@/lib/prisma";

interface TelegramMessage {
  chatId: string;
  message: string;
}

async function sendTelegramMessage({ chatId, message }: TelegramMessage) {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken || !chatId) return { success: false, error: "No token or chatId" };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    const data = await res.json();
    return { success: data.ok, error: data.description };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export interface BookingNotificationData {
  bookingId: string;
  teacherName: string;
  clientName?: string;
  activityName: string;
  spaceName: string;
  startDatetime: Date;
  endDatetime: Date;
  status: string;
  notes?: string;
}

function formatBookingMessage(data: BookingNotificationData, type: "created" | "cancelled" | "modified") {
  const emoji = type === "created" ? "✅" : type === "cancelled" ? "❌" : "✏️";
  const action = type === "created" ? "Nueva reserva confirmada" : type === "cancelled" ? "Reserva cancelada" : "Reserva modificada";

  const start = new Date(data.startDatetime);
  const end = new Date(data.endDatetime);
  const dateStr = start.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const startTime = start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  return `${emoji} <b>${action}</b>

👨‍🏫 <b>Profesor:</b> ${data.teacherName}
${data.clientName ? `👤 <b>Cliente:</b> ${data.clientName}\n` : ""}🏃 <b>Actividad:</b> ${data.activityName}
📅 <b>Día:</b> ${dateStr}
⏰ <b>Hora:</b> ${startTime} - ${endTime}
📍 <b>Espacio:</b> ${data.spaceName}
${data.notes ? `📝 <b>Notas:</b> ${data.notes}\n` : ""}
🆔 Ref: <code>${data.bookingId.slice(-8).toUpperCase()}</code>`;
}

export async function notifyBookingCreated(
  data: BookingNotificationData,
  teacherChatId?: string,
  clientChatId?: string
) {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken) return;

  const message = formatBookingMessage(data, "created");

  const promises: Promise<{ success: boolean; error?: string }>[] = [];

  if (settings.notifyAdmin && settings.adminChatId) {
    promises.push(
      sendTelegramMessage({ chatId: settings.adminChatId, message }).then(async (r) => {
        await prisma.notificationLog.create({
          data: { bookingId: data.bookingId, type: "booking_created", recipient: "admin", message, success: r.success, error: r.error },
        });
        return r;
      })
    );
  }

  if (settings.notifyTeacher && teacherChatId) {
    promises.push(
      sendTelegramMessage({ chatId: teacherChatId, message }).then(async (r) => {
        await prisma.notificationLog.create({
          data: { bookingId: data.bookingId, type: "booking_created", recipient: "teacher", message, success: r.success, error: r.error },
        });
        return r;
      })
    );
  }

  if (settings.notifyClient && clientChatId) {
    promises.push(
      sendTelegramMessage({ chatId: clientChatId, message }).then(async (r) => {
        await prisma.notificationLog.create({
          data: { bookingId: data.bookingId, type: "booking_created", recipient: "client", message, success: r.success, error: r.error },
        });
        return r;
      })
    );
  }

  await Promise.allSettled(promises);
}

export async function notifyBookingCancelled(
  data: BookingNotificationData,
  teacherChatId?: string,
  clientChatId?: string
) {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken) return;

  const message = formatBookingMessage(data, "cancelled");
  const promises: Promise<{ success: boolean; error?: string }>[] = [];

  if (settings.notifyAdmin && settings.adminChatId) {
    promises.push(sendTelegramMessage({ chatId: settings.adminChatId, message }).then(async (r) => {
      await prisma.notificationLog.create({ data: { bookingId: data.bookingId, type: "booking_cancelled", recipient: "admin", message, success: r.success, error: r.error } });
      return r;
    }));
  }
  if (settings.notifyTeacher && teacherChatId) {
    promises.push(sendTelegramMessage({ chatId: teacherChatId, message }).then(async (r) => {
      await prisma.notificationLog.create({ data: { bookingId: data.bookingId, type: "booking_cancelled", recipient: "teacher", message, success: r.success, error: r.error } });
      return r;
    }));
  }
  if (settings.notifyClient && clientChatId) {
    promises.push(sendTelegramMessage({ chatId: clientChatId, message }).then(async (r) => {
      await prisma.notificationLog.create({ data: { bookingId: data.bookingId, type: "booking_cancelled", recipient: "client", message, success: r.success, error: r.error } });
      return r;
    }));
  }

  await Promise.allSettled(promises);
}

export async function notifyBookingModified(
  data: BookingNotificationData,
  teacherChatId?: string,
  clientChatId?: string
) {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.botToken) return;

  const message = formatBookingMessage(data, "modified");
  const promises: Promise<{ success: boolean; error?: string }>[] = [];

  if (settings.notifyAdmin && settings.adminChatId) {
    promises.push(sendTelegramMessage({ chatId: settings.adminChatId, message }));
  }
  if (settings.notifyTeacher && teacherChatId) {
    promises.push(sendTelegramMessage({ chatId: teacherChatId, message }));
  }
  if (settings.notifyClient && clientChatId) {
    promises.push(sendTelegramMessage({ chatId: clientChatId, message }));
  }

  await Promise.allSettled(promises);
}
