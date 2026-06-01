import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toZonedTime } from "date-fns-tz";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";

const TZ = "Europe/Madrid";

function madridNow() { return toZonedTime(new Date(), TZ); }

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Admin can query any teacher; teacher always gets own data
  let teacherId: string;
  if (session.user.role === "ADMIN" && searchParams.get("teacherId")) {
    teacherId = searchParams.get("teacherId")!;
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    teacherId = teacher.id;
  }

  const now = madridNow();
  const todayStart = startOfDay(now, { in: { timeZone: TZ } as never });
  const todayEnd   = endOfDay(now,   { in: { timeZone: TZ } as never });
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);
  const qStart     = startOfQuarter(now);
  const qEnd       = endOfQuarter(now);

  const [
    bookingsToday, bookingsWeek, bookingsMonth, bookingsQuarter,
    availableSlots, cancelledMonth, completedMonth,
    activeClients, creditsPending, recentBookings, topClients
  ] = await Promise.all([
    // Bookings today (booked or available)
    prisma.booking.count({ where: { teacherId, startDatetime: { gte: todayStart, lte: todayEnd }, status: { in: ["BOOKED", "COMPLETED"] } } }),
    // Bookings this week
    prisma.booking.count({ where: { teacherId, startDatetime: { gte: weekStart, lte: weekEnd }, status: { in: ["BOOKED", "COMPLETED"] } } }),
    // Bookings this month
    prisma.booking.count({ where: { teacherId, startDatetime: { gte: monthStart, lte: monthEnd }, status: { in: ["BOOKED", "COMPLETED"] } } }),
    // Bookings this quarter
    prisma.booking.count({ where: { teacherId, startDatetime: { gte: qStart, lte: qEnd }, status: { in: ["BOOKED", "COMPLETED"] } } }),
    // Open (available) slots this month
    prisma.booking.count({ where: { teacherId, startDatetime: { gte: monthStart, lte: monthEnd }, status: "AVAILABLE" } }),
    // Cancelled this month
    prisma.booking.count({ where: { teacherId, startDatetime: { gte: monthStart, lte: monthEnd }, status: "CANCELLED" } }),
    // Completed this month
    prisma.booking.count({ where: { teacherId, startDatetime: { gte: monthStart, lte: monthEnd }, status: "COMPLETED" } }),
    // Active clients linked to this teacher
    prisma.clientTeacher.count({ where: { teacherId, client: { status: "ACTIVE" } } }),
    // Credits pending payment for this teacher's clients
    prisma.clientCredits.aggregate({
      where: { teacherId, paymentStatus: "UNPAID" },
      _sum: { balance: true },
    }),
    // Last 5 booked bookings
    prisma.booking.findMany({
      where: { teacherId, status: { in: ["BOOKED", "COMPLETED"] }, startDatetime: { gte: new Date(Date.now() - 7 * 86400_000) } },
      include: { client: { include: { user: { select: { name: true } } } }, activity: { select: { name: true } }, space: { select: { name: true } } },
      orderBy: { startDatetime: "desc" },
      take: 5,
    }),
    // Top 5 clients by booking count (this month)
    prisma.booking.groupBy({
      by: ["clientId"],
      where: { teacherId, startDatetime: { gte: monthStart }, clientId: { not: null }, status: { in: ["BOOKED", "COMPLETED"] } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const bookedMonth = bookingsMonth;
  const totalMonth  = bookedMonth + availableSlots;
  const occupancyRate = totalMonth > 0 ? Math.round((bookedMonth / totalMonth) * 100) : 0;

  // Resolve top client names
  const topClientIds = topClients.map(c => c.clientId!);
  const topClientUsers = await prisma.client.findMany({
    where: { id: { in: topClientIds } },
    include: { user: { select: { name: true } } },
  });
  const topClientMap = new Map(topClientUsers.map(c => [c.id, c.user.name]));

  return NextResponse.json({
    today:         bookingsToday,
    week:          bookingsWeek,
    month:         bookingsMonth,
    quarter:       bookingsQuarter,
    available:     availableSlots,
    cancelled:     cancelledMonth,
    completed:     completedMonth,
    occupancyRate,
    activeClients,
    creditsPendingBalance: creditsPending._sum.balance ?? 0,
    recentBookings: recentBookings.map(b => ({
      id: b.id,
      startDatetime: b.startDatetime.toISOString(),
      status: b.status,
      clientName: b.client?.user?.name ?? null,
      activityName: b.activity.name,
      spaceName: b.space.name,
    })),
    topClients: topClients.map(c => ({
      clientId: c.clientId,
      name: topClientMap.get(c.clientId!) ?? "—",
      count: c._count.id,
    })),
  });
}
