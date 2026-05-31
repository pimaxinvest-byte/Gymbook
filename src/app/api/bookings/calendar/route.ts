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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (start) where.startDatetime = { gte: new Date(start) };
  if (end && start) {
    where.startDatetime = { gte: new Date(start) };
    where.endDatetime = { lte: new Date(end) };
  } else if (end) {
    where.endDatetime = { lte: new Date(end) };
  }
  if (teacherId) where.teacherId = teacherId;
  if (clientId) where.clientId = clientId;
  if (activityId) where.activityId = activityId;
  if (spaceId) where.spaceId = spaceId;
  if (status) where.status = status;

  // TEACHER role: only own bookings
  if (session.user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (teacher) where.teacherId = teacher.id;
  }

  // CLIENT role: only show available + own bookings + SGT they participate in
  let clientRecord = null;
  if (session.user.role === "CLIENT") {
    clientRecord = await prisma.client.findUnique({ where: { userId: session.user.id } });

    // Get assigned teacher IDs
    const assignments = await prisma.clientTeacher.findMany({
      where: { clientId: clientRecord?.id },
      select: { teacherId: true },
    });
    const assignedTeacherIds = assignments.map((a) => a.teacherId);

    // Get SGT bookings the client participates in
    const sgtParticipations = await prisma.bookingParticipant.findMany({
      where: { clientId: clientRecord?.id },
      select: { bookingId: true },
    });
    const sgtBookingIds = sgtParticipations.map((p) => p.bookingId);

    where.OR = [
      // Available slots from assigned teachers
      { status: "AVAILABLE", teacherId: { in: assignedTeacherIds } },
      // Own individual bookings
      { clientId: clientRecord?.id },
      // SGT sessions the client is in
      { id: { in: sgtBookingIds } },
    ];
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      client: { include: { user: { select: { name: true } } } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
      participants: { include: { client: { include: { user: { select: { name: true } } } } } },
    },
    orderBy: { startDatetime: "asc" },
    take: 500,
  });

  const events = bookings.map((b) => {
    const isAvailable = b.status === "AVAILABLE";
    const isSGT = b.sessionType === "SGT";
    const occupancy = isSGT ? b.participants.length : (b.clientId ? 1 : 0);
    const isFull = isSGT ? occupancy >= b.capacity : !isAvailable;

    // Available slots: 50% opacity via classNames; booked: full
    const opacity = isAvailable ? "0.5" : "1";
    const baseColor = b.color || b.teacher.color;

    return {
      id: b.id,
      title: b.activity.name,
      start: b.startDatetime.toISOString(),
      end: b.endDatetime.toISOString(),
      backgroundColor: baseColor,
      borderColor: baseColor,
      textColor: "#ffffff",
      classNames: isAvailable ? ["fc-event-available"] : [],
      extendedProps: {
        teacherName: b.teacher.user.name,
        teacherId: b.teacherId,
        clientName: b.client?.user.name,
        activityName: b.activity.name,
        spaceName: b.space.name,
        status: b.status,
        sessionType: b.sessionType,
        capacity: b.capacity,
        occupancy,
        isFull,
        opacity,
        notes: b.notes,
        participantNames: b.participants.map((p) => p.client.user.name),
      },
    };
  });

  return NextResponse.json(events);
}
