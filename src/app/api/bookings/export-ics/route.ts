import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!teacherId || !start || !end) {
    return NextResponse.json({ error: "teacherId, start, end requeridos" }, { status: 400 });
  }

  // Auth: TEACHER can only export own; ADMIN can export any
  if (session.user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher || teacher.id !== teacherId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      teacherId,
      status: { not: "CANCELLED" },
      startDatetime: { gte: new Date(start) },
      endDatetime: { lte: new Date(end) },
    },
    include: {
      activity: { select: { name: true } },
      client: { include: { user: { select: { name: true } } } },
      space: { select: { name: true } },
    },
    orderBy: { startDatetime: "asc" },
  });

  const now = toICSDate(new Date());

  const events = bookings.map((b) => {
    const clientName = b.client?.user.name || "Sin cliente";
    const summary = escapeICS(`${b.activity.name} - ${clientName}`);
    const location = escapeICS(b.space.name);
    const description = escapeICS(`Tipo: ${b.sessionType}. Estado: ${b.status}`);
    const dtstart = toICSDate(b.startDatetime);
    const dtend = toICSDate(b.endDatetime);

    return [
      "BEGIN:VEVENT",
      `UID:booking-${b.id}@gymbook`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GymBook//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="gymbook-agenda.ics"`,
    },
  });
}
