import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { subDays } from "date-fns";

/**
 * GET /api/teacher/logs
 * Returns recent booking activity for a teacher: bookings by status with client & activity info.
 * Query params:
 *   teacherId  — admin only; defaults to own teacher
 *   days       — lookback window in days (default 30, max 365)
 *   status     — filter by status (BOOKED|COMPLETED|CANCELLED|AVAILABLE)
 *   page       — pagination page (default 1)
 *   limit      — items per page (default 20, max 100)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Resolve teacher
  let teacherId: string;
  if (session.user.role === "ADMIN" && searchParams.get("teacherId")) {
    teacherId = searchParams.get("teacherId")!;
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    teacherId = teacher.id;
  }

  // Parse params
  const days    = Math.min(Number(searchParams.get("days") ?? "30"), 365);
  const status  = searchParams.get("status") || undefined;
  const page    = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit   = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const since   = subDays(new Date(), days);

  const statusFilter = status && Object.values(BookingStatus).includes(status as BookingStatus)
    ? (status as BookingStatus)
    : undefined;

  const where = {
    teacherId,
    startDatetime: { gte: since },
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: {
        client: { include: { user: { select: { name: true } } } },
        activity: { select: { name: true } },
        space: { select: { name: true } },
      },
      orderBy: { startDatetime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pages: Math.ceil(total / limit),
    items: bookings.map(b => ({
      id:            b.id,
      startDatetime: b.startDatetime.toISOString(),
      endDatetime:   b.endDatetime.toISOString(),
      status:        b.status,
      sessionType:   b.sessionType,
      clientName:    ("client" in b && b.client) ? (b.client as { user?: { name?: string | null } }).user?.name ?? null : null,
      activityName:  ("activity" in b && b.activity) ? (b.activity as { name: string }).name : "—",
      spaceName:     ("space" in b && b.space) ? (b.space as { name: string }).name : "—",
      createdAt:     b.createdAt.toISOString(),
      updatedAt:     b.updatedAt.toISOString(),
    })),
  });
}
