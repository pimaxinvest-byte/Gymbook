import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const TZ = "Europe/Madrid";

const schema = z.object({
  from:        z.string(), // ISO date "YYYY-MM-DD" in Madrid time
  to:          z.string(), // ISO date "YYYY-MM-DD" in Madrid time
  daysOfWeek:  z.array(z.number().int().min(0).max(6)).optional(), // JS convention 0=Sun..6=Sat
  teacherId:   z.string().optional(), // admin-only override
});

/**
 * POST /api/bookings/bulk-close
 * Deletes all AVAILABLE (unbooked) slots in the given date range for the current teacher.
 * Body: { from, to, daysOfWeek?, teacherId? }
 * Returns: { deleted: number }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "ADMIN";
  const isTeacher = session.user.role === "TEACHER";
  if (!isAdmin && !isTeacher) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { from, to, daysOfWeek, teacherId: bodyTeacherId } = parsed.data;

  // Resolve teacher
  let teacherId: string;
  if (isAdmin && bodyTeacherId) {
    teacherId = bodyTeacherId;
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
    teacherId = teacher.id;
  }

  // Convert Madrid dates to UTC range
  const fromUtc = fromZonedTime(`${from}T00:00:00`, TZ);
  const toUtc   = fromZonedTime(`${to}T23:59:59`, TZ);

  // Find matching AVAILABLE slots
  const matching = await prisma.booking.findMany({
    where: {
      teacherId,
      status: "AVAILABLE",
      startDatetime: { gte: fromUtc, lte: toUtc },
    },
    select: { id: true, startDatetime: true },
  });

  // Filter by days of week if provided (check in Madrid timezone)
  let toDelete = matching;
  if (daysOfWeek && daysOfWeek.length > 0) {
    toDelete = matching.filter((b) => {
      const madridDateStr = b.startDatetime.toLocaleDateString("en-CA", { timeZone: TZ });
      const jsDay = parseISO(madridDateStr).getDay(); // 0=Sun..6=Sat
      return daysOfWeek.includes(jsDay);
    });
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const { count } = await prisma.booking.deleteMany({
    where: { id: { in: toDelete.map((b) => b.id) } },
  });

  return NextResponse.json({ deleted: count });
}

/**
 * GET /api/bookings/bulk-close?from=&to=&daysOfWeek=0,1,2
 * Preview: returns count of AVAILABLE slots that would be deleted.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "ADMIN";
  const isTeacher = session.user.role === "TEACHER";
  if (!isAdmin && !isTeacher) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to")   ?? "";
  if (!from || !to) return NextResponse.json({ count: 0 });

  let teacherId: string;
  if (isAdmin && searchParams.get("teacherId")) {
    teacherId = searchParams.get("teacherId")!;
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ count: 0 });
    teacherId = teacher.id;
  }

  const fromUtc = fromZonedTime(`${from}T00:00:00`, TZ);
  const toUtc   = fromZonedTime(`${to}T23:59:59`, TZ);

  const rawDays = searchParams.get("daysOfWeek");
  const daysOfWeek = rawDays ? rawDays.split(",").map(Number).filter(n => n >= 0 && n <= 6) : null;

  const matching = await prisma.booking.findMany({
    where: { teacherId, status: "AVAILABLE", startDatetime: { gte: fromUtc, lte: toUtc } },
    select: { id: true, startDatetime: true },
  });

  const filtered = daysOfWeek && daysOfWeek.length > 0
    ? matching.filter((b) => {
        const madridDateStr = b.startDatetime.toLocaleDateString("en-CA", { timeZone: TZ });
        const jsDay = parseISO(madridDateStr).getDay();
        return daysOfWeek.includes(jsDay);
      })
    : matching;

  return NextResponse.json({ count: filtered.length });
}
