import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  const [today, week, month, byTeacher, byActivity, total] = await Promise.all([
    prisma.booking.count({
      where: { startDatetime: { gte: startOfDay(now), lte: endOfDay(now) }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.booking.count({
      where: { startDatetime: { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.booking.count({
      where: { startDatetime: { gte: startOfMonth(now), lte: endOfMonth(now) }, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.booking.groupBy({
      by: ["teacherId"],
      _count: { id: true },
      where: { startDatetime: { gte: startOfMonth(now) }, status: { notIn: ["CANCELLED"] } },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.booking.groupBy({
      by: ["activityId"],
      _count: { id: true },
      where: { startDatetime: { gte: startOfMonth(now) }, status: { notIn: ["CANCELLED"] } },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.booking.count({ where: { status: { notIn: ["CANCELLED"] } } }),
  ]);

  // Enrich teacher stats
  const teacherIds = byTeacher.map((t) => t.teacherId);
  const teachers = await prisma.teacher.findMany({
    where: { id: { in: teacherIds } },
    include: { user: { select: { name: true } } },
  });

  const activityIds = byActivity.map((a) => a.activityId);
  const activities = await prisma.activity.findMany({ where: { id: { in: activityIds } } });

  return NextResponse.json({
    today,
    week,
    month,
    total,
    byTeacher: byTeacher.map((t) => ({
      teacherId: t.teacherId,
      name: teachers.find((x) => x.id === t.teacherId)?.user.name || "N/A",
      count: t._count.id,
    })),
    byActivity: byActivity.map((a) => ({
      activityId: a.activityId,
      name: activities.find((x) => x.id === a.activityId)?.name || "N/A",
      count: a._count.id,
    })),
  });
}
