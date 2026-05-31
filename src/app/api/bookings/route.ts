import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyBookingCreated } from "@/lib/telegram";

const createSchema = z.object({
  teacherId: z.string(),
  spaceId: z.string(),
  activityId: z.string(),
  startDatetime: z.string(),
  endDatetime: z.string(),
  clientId: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["AVAILABLE", "BOOKED", "BLOCKED"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // For TEACHER role: force their own teacherId
    let teacherId = data.teacherId;
    if (session.user.role === "TEACHER") {
      const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
      if (!teacher) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
      teacherId = teacher.id;
    }

    const start = new Date(data.startDatetime);
    const end = new Date(data.endDatetime);

    // Check overlap
    const overlap = await prisma.booking.findFirst({
      where: {
        spaceId: data.spaceId,
        status: { notIn: ["CANCELLED"] },
        OR: [
          { startDatetime: { lt: end }, endDatetime: { gt: start } },
        ],
      },
    });

    if (overlap) {
      return NextResponse.json(
        { error: "Conflicto de horario en este espacio" },
        { status: 409 }
      );
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { name: true, telegramChatId: true } } },
    });

    const booking = await prisma.booking.create({
      data: {
        teacherId,
        spaceId: data.spaceId,
        activityId: data.activityId,
        startDatetime: start,
        endDatetime: end,
        clientId: data.clientId,
        notes: data.notes,
        status: data.status || "AVAILABLE",
        color: teacher?.color,
        createdById: session.user.id,
      },
      include: {
        activity: { select: { name: true } },
        space: { select: { name: true } },
        client: { include: { user: { select: { name: true, telegramChatId: true } } } },
      },
    });

    // Telegram notifications (non-blocking)
    notifyBookingCreated(
      {
        bookingId: booking.id,
        teacherName: teacher?.user.name || "N/A",
        clientName: booking.client?.user.name,
        activityName: booking.activity.name,
        spaceName: booking.space.name,
        startDatetime: booking.startDatetime,
        endDatetime: booking.endDatetime,
        status: booking.status,
        notes: booking.notes || undefined,
      },
      teacher?.user.telegramChatId || undefined,
      booking.client?.user.telegramChatId || undefined
    ).catch(console.error);

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};
  if (session.user.role === "CLIENT") {
    const client = await prisma.client.findUnique({ where: { userId: session.user.id } });
    where.clientId = client?.id;
  } else if (session.user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    where.teacherId = teacher?.id;
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        client: { include: { user: { select: { name: true } } } },
        activity: { select: { name: true } },
        space: { select: { name: true } },
      },
      orderBy: { startDatetime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return NextResponse.json({ bookings, total, page, pages: Math.ceil(total / limit) });
}
