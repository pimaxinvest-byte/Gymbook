import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  subWeeks, startOfISOWeek, endOfISOWeek,
  getISOWeek, getISOWeekYear,
} from "date-fns";

function getPeriodRange(period: string, start?: string, end?: string): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "custom":
      if (start && end) {
        return { from: new Date(start), to: new Date(end) };
      }
      return { from: startOfMonth(now), to: endOfMonth(now) };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") || "month";
  const startParam = searchParams.get("start") ?? undefined;
  const endParam = searchParams.get("end") ?? undefined;
  const teacherIdFilter = searchParams.get("teacherId") ?? undefined;
  const activityIdFilter = searchParams.get("activityId") ?? undefined;
  const spaceIdFilter = searchParams.get("spaceId") ?? undefined;
  const clientIdFilter = searchParams.get("clientId") ?? undefined;

  const { from, to } = getPeriodRange(period, startParam, endParam);

  // Build base where clause
  const baseWhere: Record<string, unknown> = {
    startDatetime: { gte: from, lte: to },
    ...(teacherIdFilter && { teacherId: teacherIdFilter }),
    ...(activityIdFilter && { activityId: activityIdFilter }),
    ...(spaceIdFilter && { spaceId: spaceIdFilter }),
    ...(clientIdFilter && { clientId: clientIdFilter }),
  };

  const activeWhere = { ...baseWhere, status: { in: ["BOOKED", "COMPLETED"] as ("BOOKED" | "COMPLETED")[] } };

  // ── Parallel queries ──────────────────────────────────────────────────────
  const [
    bookings,               // raw bookings for weekday/hour grouping
    availableCount,
    cancelledCount,
    checkInsCount,
    totalHoursAgg,
    byActivityRaw,
    byTeacherRaw,
    bySpaceRaw,
    creditSummary,
    unpaidCount,
    partialCount,
  ] = await Promise.all([
    // Fetch all active bookings for JS-side grouping
    prisma.booking.findMany({
      where: activeWhere,
      select: { startDatetime: true, endDatetime: true },
    }),

    prisma.booking.count({ where: { ...baseWhere, status: "AVAILABLE" } }),
    prisma.booking.count({ where: { ...baseWhere, status: "CANCELLED" } }),
    prisma.booking.count({ where: { ...baseWhere, status: "COMPLETED" } }),

    // Sum hours — we do this in JS from the bookings array above (no SQL sum on diff)
    // Placeholder: returns nothing; we compute below
    Promise.resolve(null),

    prisma.booking.groupBy({
      by: ["activityId"],
      _count: { id: true },
      where: activeWhere,
      orderBy: { _count: { id: "desc" } },
    }),

    prisma.booking.groupBy({
      by: ["teacherId"],
      _count: { id: true },
      where: activeWhere,
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),

    prisma.booking.groupBy({
      by: ["spaceId"],
      _count: { id: true },
      where: activeWhere,
      orderBy: { _count: { id: "desc" } },
    }),

    prisma.clientCredits.aggregate({
      _sum: { balance: true, totalAssigned: true, amountPaid: true },
      _count: { id: true },
    }),

    prisma.clientCredits.count({ where: { paymentStatus: "UNPAID" } }),
    prisma.clientCredits.count({ where: { paymentStatus: "PARTIAL" } }),
  ]);

  void totalHoursAgg; // unused placeholder

  // ── Core metrics ──────────────────────────────────────────────────────────
  const totalBookings = bookings.length;

  let totalHours = 0;
  bookings.forEach((b) => {
    totalHours += (b.endDatetime.getTime() - b.startDatetime.getTime()) / 3_600_000;
  });

  const occupancyRate =
    totalBookings + availableCount > 0
      ? (totalBookings / (totalBookings + availableCount)) * 100
      : 0;

  const noShows = totalBookings - checkInsCount;

  // ── By weekday ────────────────────────────────────────────────────────────
  const bookingsByDayCount = [0, 0, 0, 0, 0, 0, 0];
  bookings.forEach((b) => {
    const day = (b.startDatetime.getDay() + 6) % 7; // Mon=0 … Sun=6
    bookingsByDayCount[day]++;
  });
  const byWeekday = DAY_NAMES.map((day, i) => ({ day, count: bookingsByDayCount[i] }));

  // ── By hour ───────────────────────────────────────────────────────────────
  const byHourMap: Record<number, number> = {};
  bookings.forEach((b) => {
    const h = b.startDatetime.getHours();
    byHourMap[h] = (byHourMap[h] || 0) + 1;
  });
  const byHour = Object.entries(byHourMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([h, count]) => ({ hour: `${String(h).padStart(2, "0")}:00`, count }));

  // ── Enrich groupBy results ────────────────────────────────────────────────
  const [activities, teachers, spaces] = await Promise.all([
    prisma.activity.findMany({
      where: { id: { in: byActivityRaw.map((a) => a.activityId) } },
      select: { id: true, name: true },
    }),
    prisma.teacher.findMany({
      where: { id: { in: byTeacherRaw.map((t) => t.teacherId) } },
      include: { user: { select: { name: true } } },
    }),
    prisma.space.findMany({
      where: { id: { in: bySpaceRaw.map((s) => s.spaceId) } },
      select: { id: true, name: true },
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byActivity = byActivityRaw.map((a: any) => ({
    activityId: a.activityId,
    name: activities.find((x) => x.id === a.activityId)?.name ?? "N/A",
    count: a._count?.id ?? 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byTeacher = byTeacherRaw.map((t: any) => ({
    teacherId: t.teacherId,
    name: teachers.find((x) => x.id === t.teacherId)?.user.name ?? "N/A",
    count: t._count?.id ?? 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bySpace = bySpaceRaw.map((s: any) => ({
    spaceId: s.spaceId,
    name: spaces.find((x) => x.id === s.spaceId)?.name ?? "N/A",
    count: s._count?.id ?? 0,
  }));

  // ── Weekly trend (last 8 ISO weeks) ──────────────────────────────────────
  const now = new Date();
  const weeklyTrendData: { week: string; count: number }[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekDate = subWeeks(now, i);
    const weekStart = startOfISOWeek(weekDate);
    const weekEnd = endOfISOWeek(weekDate);
    const isoWeek = getISOWeek(weekDate);
    const isoYear = getISOWeekYear(weekDate);

    const count = await prisma.booking.count({
      where: {
        startDatetime: { gte: weekStart, lte: weekEnd },
        status: { in: ["BOOKED", "COMPLETED"] as ("BOOKED" | "COMPLETED")[] },
        ...(teacherIdFilter && { teacherId: teacherIdFilter }),
        ...(activityIdFilter && { activityId: activityIdFilter }),
        ...(spaceIdFilter && { spaceId: spaceIdFilter }),
        ...(clientIdFilter && { clientId: clientIdFilter }),
      },
    });

    weeklyTrendData.push({ week: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`, count });
  }

  // ── Smart insights ────────────────────────────────────────────────────────
  const topDemandDayIndex = bookingsByDayCount.indexOf(Math.max(...bookingsByDayCount));
  const topDemandDay = bookingsByDayCount[topDemandDayIndex] > 0 ? DAY_NAMES[topDemandDayIndex] : "—";

  const topHourEntry = Object.entries(byHourMap).sort((a, b) => b[1] - a[1])[0];
  const topTimeSlot = topHourEntry ? `${String(topHourEntry[0]).padStart(2, "0")}:00` : "—";

  const topTeacherEntry = byTeacher[0];
  const topTeacher = topTeacherEntry?.name ?? "—";

  const topActivityEntry = byActivity[0];
  const topActivity = topActivityEntry?.name ?? "—";

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },

    // Core metrics
    totalBookings,
    totalHours,
    availableSlots: availableCount,
    cancelledBookings: cancelledCount,
    occupancyRate,
    checkIns: checkInsCount,
    noShows,

    // Grouped data
    byWeekday,
    byHour,
    byActivity,
    byTeacher,
    bySpace,
    weeklyTrend: weeklyTrendData,

    // Credits
    creditSummary: {
      totalCredits: creditSummary._count.id,
      totalAssigned: creditSummary._sum.totalAssigned ?? 0,
      totalPaid: creditSummary._sum.amountPaid ?? 0,
      unpaidCount,
      partialCount,
    },

    // Insights
    insights: {
      topDemandDay,
      topTimeSlot,
      topTeacher,
      topActivity,
    },
  });
}
