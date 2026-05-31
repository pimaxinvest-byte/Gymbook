/**
 * GET    /api/admin/clients/[id] — full client detail
 * PATCH  /api/admin/clients/[id] — edit client / approve / reject
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  status:            z.enum(["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"]).optional(),
  rejectedReason:    z.string().optional(),
  notes:             z.string().optional(),
  preferredActivityId: z.string().nullable().optional(),
  preferredTeacherId:  z.string().nullable().optional(),
  // User fields
  name:  z.string().min(1).optional(),
  phone: z.string().optional(),
  goals: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id:                true,
          name:              true,
          email:             true,
          telegramChatId:    true,
          telegramUsername:  true,
          telegramPhone:     true,
          telegramConnected: true,
          avatarUrl:         true,
          createdAt:         true,
        },
      },
      clientTeachers: {
        include: { teacher: { include: { user: { select: { name: true } } } } },
      },
      preferredActivity:  { select: { id: true, name: true } },
      preferredTeacher:   { include: { user: { select: { name: true } } } },
      bookings: {
        orderBy: { startDatetime: "desc" },
        take: 10,
        include: {
          teacher:  { include: { user: { select: { name: true } } } },
          activity: { select: { name: true } },
          space:    { select: { name: true } },
        },
      },
    },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(client);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const data = patchSchema.parse(body);

  const client = await prisma.client.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If activating, record the date
  const activatedAt = data.status === "ACTIVE" && client.status !== "ACTIVE"
    ? new Date()
    : undefined;

  const { name, phone, goals, ...clientData } = data;

  // Update Client record
  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...clientData,
      ...(activatedAt ? { activatedAt } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(goals !== undefined ? { goals } : {}),
    },
    include: {
      user: { select: { name: true, email: true, telegramChatId: true } },
    },
  });

  // Update User name if provided
  if (name) {
    await prisma.user.update({
      where: { id: client.userId },
      data:  { name },
    });
  }

  // Send Telegram welcome if activating
  if (data.status === "ACTIVE" && client.status !== "ACTIVE") {
    const settings = await prisma.telegramSettings.findFirst();
    if (settings?.botToken && client.user.telegramChatId) {
      fetch(`https://api.telegram.org/bot${settings.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: client.user.telegramChatId,
          text: `✅ <b>¡Bienvenido/a a GymBook!</b>\n\nHola ${client.user.name} 👋\nTu cuenta ha sido activada. Ya puedes reservar tus sesiones.`,
          parse_mode: "HTML",
        }),
      }).catch(console.error);
    }
  }

  return NextResponse.json(updated);
}
