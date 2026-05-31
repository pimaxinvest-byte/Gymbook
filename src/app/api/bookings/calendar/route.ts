import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const teacherId = searchParams.get("teacherId");
  const clientId = searchParams.get("clientId");
  const activityId = searchParams.get("activityId");
  const spaceId = searchParams.get("spaceId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};

  if (start) where.startDatetime = { gte: new Date(start) };
  if (end) where.endDatetime = { lte: new Date(end) };
  if (teacherId) where.teacherId = teacherId;
  if (clientId) where.clientId = clientId;
  if (activityId) where.activityId = activityId;
  if (spaceId) where.spaceId = spaceId;
  if (status) where.status = status;

  // CLIENT role: only show available + own bookings
  if (session.user.role === "CLIENT") {
    const client = await prisma.client.findUnique({ where: { userId: session.user.id } });
    where.OR = [{ status: "AVAILABLE" }, { clientId: client?.id }];
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      client: { include: { user: { select: { name: true } } } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
    },
    orderBy: { startDatetime: "asc" },
    take: 500,
  });

  const events = bookings.map((b) => ({
    id: b.id,
    title: b.activity.name,
    start: b.startDatetime.toISOString(),
    end: b.endDatetime.toISOString(),
    backgroundColor: b.teacher.color,
    borderColor: b.teacher.color,
    textColor: "#ffffff",
    extendedProps: {
      teacherName: b.teacher.user.name,
      clientName: b.client?.user.name,
      activityName: b.activity.name,
      spaceName: b.space.name,
      status: b.status,
      notes: b.notes,
      teacherId: b.teacherId,
    },
  }));

  return NextResponse.json(events);
}
