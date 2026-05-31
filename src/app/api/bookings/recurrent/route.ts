import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays, parseISO, isAfter } from "date-fns";
import { checkBookingConflicts } from "@/lib/booking-conflicts";

const schema = z.object({
  teacherId: z.string().optional(),
  spaceId: z.string(),
  activityId: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  startDate: z.string(),
  endDate: z.string(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1), // FullCalendar convention 0=Sun..6=Sat
  notes: z.string().optional(),
  sessionType: z.enum(["INDIVIDUAL", "SGT"]).default("INDIVIDUAL"),
  capacity: z.number().int().min(1).max(5).default(1),
});

function setTimeOnDate(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

// GET /api/bookings/recurrent?mine=true — list teacher's recurrence rules
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (session.user.role === "TEACHER" || mine) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json([], { status: 200 });
    where.teacherId = teacher.id;
  }

  const rules = await prisma.bookingRecurrenceRule.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // For each rule, count bookings created
  const enriched = await Promise.all(
    rules.map(async (rule) => {
      const count = await prisma.booking.count({ where: { recurrenceRuleId: rule.id } });
      const activity = await prisma.activity.findUnique({ where: { id: rule.activityId }, select: { name: true } });
      const space = await prisma.space.findUnique({ where: { id: rule.spaceId }, select: { name: true } });

      // Get session type from first booking
      const firstBooking = await prisma.booking.findFirst({
        where: { recurrenceRuleId: rule.id },
        select: { sessionType: true },
      });

      // daysOfWeek stored in rule — map each to a display row
      return rule.daysOfWeek.map((day) => ({
        id: `${rule.id}_${day}`,
        ruleId: rule.id,
        day,
        startTime: rule.startTime,
        endTime: rule.endTime,
        activityName: activity?.name || "—",
        spaceName: space?.name || "—",
        sessionType: firstBooking?.sessionType || "INDIVIDUAL",
        bookingsCreated: count,
      }));
    })
  );

  return NextResponse.json(enriched.flat());
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

    let teacherId = data.teacherId || "";
    let teacherRecord;

    if (session.user.role === "TEACHER") {
      teacherRecord = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
      if (!teacherRecord) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      teacherId = teacherRecord.id;
    } else {
      teacherRecord = await prisma.teacher.findUnique({ where: { id: teacherId } });
    }

    const activity = await prisma.activity.findUnique({ where: { id: data.activityId }, select: { name: true } });
    const space = await prisma.space.findUnique({ where: { id: data.spaceId }, select: { name: true } });
    void activity; void space;

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

    // Generate dates — FullCalendar convention: 0=Sun, 1=Mon, ..., 6=Sat
    const slots: { start: Date; end: Date }[] = [];
    let current = parseISO(data.startDate);
    const endDate = parseISO(data.endDate);

    while (!isAfter(current, endDate)) {
      const jsDay = current.getDay(); // 0=Sun..6=Sat (same as FC)
      if (data.daysOfWeek.includes(jsDay)) {
        const start = setTimeOnDate(current, data.startTime);
        const end = setTimeOnDate(current, data.endTime);
        if (start > new Date()) {
          slots.push({ start, end });
        }
      }
      current = addDays(current, 1);
    }

    // Check space + teacher conflicts for each slot
    const conflicts: string[] = [];
    const created: { start: Date; end: Date }[] = [];

    for (const slot of slots) {
      const conflict = await checkBookingConflicts({
        spaceId:       data.spaceId,
        teacherId,
        startDatetime: slot.start,
        endDatetime:   slot.end,
      });
      if (conflict.hasConflict) {
        conflicts.push(`${slot.start.toLocaleDateString("es-ES")} ${data.startTime} (${conflict.reason})`);
        continue;
      }
      created.push(slot);
    }

    // Batch create bookings
    if (created.length > 0) {
      await prisma.booking.createMany({
        data: created.map((slot) => ({
          teacherId,
          spaceId: data.spaceId,
          activityId: data.activityId,
          startDatetime: slot.start,
          endDatetime: slot.end,
          status: "AVAILABLE" as const,
          sessionType: data.sessionType,
          capacity: data.sessionType === "SGT" ? data.capacity : 1,
          color: teacherRecord?.color,
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
