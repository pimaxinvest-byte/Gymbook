import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays, setHours, setMinutes, parseISO, isBefore, isAfter } from "date-fns";

const schema = z.object({
  teacherId: z.string(),
  spaceId: z.string(),
  activityId: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  startDate: z.string(),
  endDate: z.string(),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1),
  notes: z.string().optional(),
});

function setTimeOnDate(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);

    let teacherId = data.teacherId;
    if (session.user.role === "TEACHER") {
      const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
      if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      teacherId = teacher.id;
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { name: true, telegramChatId: true } } },
    });
    const activity = await prisma.activity.findUnique({ where: { id: data.activityId }, select: { name: true } });
    const space = await prisma.space.findUnique({ where: { id: data.spaceId }, select: { name: true } });

    // Create recurrence rule
    const rule = await prisma.bookingRecurrenceRule.create({
      data: {
        daysOfWeek: data.daysOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        startDate: parseISO(data.startDate),
        endDate: parseISO(data.endDate),
        spaceId: data.spaceId,
        activityId: data.activityId,
        teacherId,
      },
    });

    // Generate dates
    const slots: { start: Date; end: Date }[] = [];
    let current = parseISO(data.startDate);
    const endDate = parseISO(data.endDate);

    // JS getDay: 0=Sun,1=Mon...6=Sat. Our convention: 1=Mon...7=Sun
    function jsToOurDay(jsDay: number) {
      return jsDay === 0 ? 7 : jsDay;
    }

    while (!isAfter(current, endDate)) {
      const dayOfWeek = jsToOurDay(current.getDay());
      if (data.daysOfWeek.includes(dayOfWeek)) {
        const start = setTimeOnDate(current, data.startTime);
        const end = setTimeOnDate(current, data.endTime);
        slots.push({ start, end });
      }
      current = addDays(current, 1);
    }

    // Check conflicts
    const conflicts: string[] = [];
    const created: { start: Date; end: Date }[] = [];

    for (const slot of slots) {
      const overlap = await prisma.booking.findFirst({
        where: {
          spaceId: data.spaceId,
          status: { notIn: ["CANCELLED"] },
          startDatetime: { lt: slot.end },
          endDatetime: { gt: slot.start },
        },
      });

      if (overlap) {
        conflicts.push(
          `${slot.start.toLocaleDateString("es-ES")} ${data.startTime}–${data.endTime}`
        );
      } else {
        created.push(slot);
      }
    }

    // Create non-conflicting bookings
    if (created.length > 0) {
      await prisma.booking.createMany({
        data: created.map((slot) => ({
          teacherId,
          spaceId: data.spaceId,
          activityId: data.activityId,
          startDatetime: slot.start,
          endDatetime: slot.end,
          status: "AVAILABLE" as const,
          color: teacher?.color,
          notes: data.notes,
          recurrenceRuleId: rule.id,
          createdById: session.user.id,
        })),
      });
    }

    return NextResponse.json({
      created: created.length,
      skipped: conflicts.length,
      conflicts,
      ruleId: rule.id,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
