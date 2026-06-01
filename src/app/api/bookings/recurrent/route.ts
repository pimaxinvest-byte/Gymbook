import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays, parseISO, isAfter } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { checkBookingConflicts } from "@/lib/booking-conflicts";

const TIMEZONE = "Europe/Madrid";

const schema = z.object({
  teacherId:    z.string().optional(),
  spaceId:      z.string(),
  activityId:   z.string(),
  startTime:    z.string().regex(/^\d{2}:\d{2}$/),
  endTime:      z.string().regex(/^\d{2}:\d{2}$/),
  slotDuration: z.number().int().min(15).max(180).default(60), // minutes per slot within the range
  startDate:    z.string(),
  endDate:      z.string(),
  daysOfWeek:   z.array(z.number().int().min(0).max(6)).min(1), // FullCalendar convention 0=Sun..6=Sat
  notes:        z.string().optional(),
  sessionType:  z.enum(["INDIVIDUAL", "SGT"]).default("INDIVIDUAL"),
  capacity:     z.number().int().min(1).max(5).default(1),
});

/**
 * Convert a date + "HH:MM" string in Europe/Madrid into a UTC Date.
 * Uses date-fns-tz for correct DST handling.
 */
function setMadridTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  // Get the calendar date in Madrid to avoid day-boundary issues
  const madridDateStr = date.toLocaleDateString("en-CA", { timeZone: TIMEZONE }); // "YYYY-MM-DD"
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return fromZonedTime(`${madridDateStr}T${hh}:${mm}:00`, TIMEZONE);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins: number): string {
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
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

  // Enrich each rule with metadata
  const enriched = await Promise.all(
    rules.map(async (rule) => {
      const count    = await prisma.booking.count({ where: { recurrenceRuleId: rule.id } });
      const activity = await prisma.activity.findUnique({ where: { id: rule.activityId }, select: { name: true } });
      const space    = await prisma.space.findUnique({ where: { id: rule.spaceId }, select: { name: true } });
      const firstBooking = await prisma.booking.findFirst({
        where: { recurrenceRuleId: rule.id },
        select: { sessionType: true },
      });

      const slotDuration = rule.slotDuration ?? 60;
      const rangeMinutes = timeToMinutes(rule.endTime) - timeToMinutes(rule.startTime);
      const slotsPerDay  = rangeMinutes > 0 ? Math.floor(rangeMinutes / slotDuration) : 1;

      return rule.daysOfWeek.map((day) => ({
        id:             `${rule.id}_${day}`,
        ruleId:         rule.id,
        day,
        startTime:      rule.startTime,
        endTime:        rule.endTime,
        slotDuration,
        slotsPerDay,
        activityName:   activity?.name || "—",
        spaceName:      space?.name || "—",
        sessionType:    firstBooking?.sessionType || "INDIVIDUAL",
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

    // Validate range: endTime must be after startTime and have room for at least one slot
    const rangeStart = timeToMinutes(data.startTime);
    const rangeEnd   = timeToMinutes(data.endTime);
    if (rangeEnd <= rangeStart) {
      return NextResponse.json({ error: "La hora de fin debe ser posterior a la de inicio" }, { status: 400 });
    }
    if (rangeEnd - rangeStart < data.slotDuration) {
      return NextResponse.json(
        { error: `La franja (${rangeEnd - rangeStart} min) es menor que la duración de sesión (${data.slotDuration} min)` },
        { status: 400 }
      );
    }

    let teacherId = data.teacherId || "";
    let teacherRecord;

    if (session.user.role === "TEACHER") {
      teacherRecord = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
      if (!teacherRecord) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      teacherId = teacherRecord.id;
    } else {
      teacherRecord = await prisma.teacher.findUnique({ where: { id: teacherId } });
    }

    // Create recurrence rule (startTime/endTime are the range boundaries)
    const rule = await prisma.bookingRecurrenceRule.create({
      data: {
        daysOfWeek:   data.daysOfWeek,
        startTime:    data.startTime,
        endTime:      data.endTime,
        slotDuration: data.slotDuration,
        startDate:    parseISO(data.startDate),
        endDate:      parseISO(data.endDate),
        spaceId:      data.spaceId,
        activityId:   data.activityId,
        teacherId,
      },
    });

    // Generate individual slots within the range for each matching day
    // e.g. range 14:00–18:00, slotDuration=60 → slots at 14:00, 15:00, 16:00, 17:00
    const slots: { start: Date; end: Date }[] = [];
    let current = parseISO(data.startDate);
    const endDate = parseISO(data.endDate);
    const now = new Date();

    while (!isAfter(current, endDate)) {
      const jsDay = current.getDay(); // 0=Sun..6=Sat (same as FC convention)
      if (data.daysOfWeek.includes(jsDay)) {
        let slotStartMins = rangeStart;
        while (slotStartMins + data.slotDuration <= rangeEnd) {
          const start = setMadridTime(current, minutesToTimeStr(slotStartMins));
          const end   = setMadridTime(current, minutesToTimeStr(slotStartMins + data.slotDuration));
          if (start > now) {
            slots.push({ start, end });
          }
          slotStartMins += data.slotDuration;
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
        conflicts.push(
          `${slot.start.toLocaleDateString("es-ES")} ${slot.start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} (${conflict.reason})`
        );
        continue;
      }
      created.push(slot);
    }

    // Batch-create bookings
    if (created.length > 0) {
      await prisma.booking.createMany({
        data: created.map((slot) => ({
          teacherId,
          spaceId:       data.spaceId,
          activityId:    data.activityId,
          startDatetime: slot.start,
          endDatetime:   slot.end,
          status:        "AVAILABLE" as const,
          sessionType:   data.sessionType,
          capacity:      data.sessionType === "SGT" ? data.capacity : 1,
          color:         teacherRecord?.color,
          recurrenceRuleId: rule.id,
          createdById:   session.user.id,
        })),
      });
    }

    return NextResponse.json({
      created:      created.length,
      skipped:      conflicts.length,
      conflicts,
      ruleId:       rule.id,
      slotDuration: data.slotDuration,
      slotsPerDay:  Math.floor((rangeEnd - rangeStart) / data.slotDuration),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
