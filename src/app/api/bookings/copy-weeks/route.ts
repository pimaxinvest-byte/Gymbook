import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addWeeks } from "date-fns";
import { checkBookingConflicts } from "@/lib/booking-conflicts";

/**
 * POST /api/bookings/copy-weeks
 * Body: { bookingIds: string[], weeks: number }
 * Copies each AVAILABLE booking N weeks forward, skipping conflicts.
 * Returns: { created, skipped }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { bookingIds, weeks } = body as { bookingIds?: string[]; weeks?: number };

  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "bookingIds requerido" }, { status: 400 });
  }
  if (!weeks || weeks < 1 || weeks > 52) {
    return NextResponse.json({ error: "weeks debe ser entre 1 y 52" }, { status: 400 });
  }

  // Resolve own teacher if needed
  let teacherId: string | null = null;
  if (session.user.role === "TEACHER") {
    const t = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!t) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
    teacherId = t.id;
  }

  // Load source bookings
  const sources = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds },
      status: "AVAILABLE",
      ...(teacherId ? { teacherId } : {}),
    },
  });

  let created = 0;
  let skipped = 0;

  for (let w = 1; w <= weeks; w++) {
    for (const src of sources) {
      const start = addWeeks(src.startDatetime, w);
      const end   = addWeeks(src.endDatetime, w);

      const conflict = await checkBookingConflicts({
        spaceId:       src.spaceId,
        teacherId:     src.teacherId,
        startDatetime: start,
        endDatetime:   end,
      });

      if (conflict.hasConflict) {
        skipped++;
        continue;
      }

      await prisma.booking.create({
        data: {
          teacherId:    src.teacherId,
          spaceId:      src.spaceId,
          activityId:   src.activityId,
          startDatetime: start,
          endDatetime:   end,
          status:        "AVAILABLE",
          sessionType:   src.sessionType,
          capacity:      src.capacity,
          color:         src.color,
          notes:         src.notes,
          createdById:   session.user.id,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created, skipped });
}
