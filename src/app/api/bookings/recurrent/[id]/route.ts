import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/bookings/recurrent/[id] — delete rule + future AVAILABLE bookings
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "TEACHER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Extract real ruleId (could be "ruleId_day" format from GET)
  const rawId = (await params).id;
  const ruleId = rawId.split("_")[0];

  const rule = await prisma.bookingRecurrenceRule.findUnique({ where: { id: ruleId } });
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Teachers can only delete their own rules
  if (session.user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (rule.teacherId !== teacher?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const now = new Date();

  // Delete future AVAILABLE bookings (don't touch BOOKED/COMPLETED)
  const deleted = await prisma.booking.deleteMany({
    where: {
      recurrenceRuleId: ruleId,
      status: "AVAILABLE",
      startDatetime: { gte: now },
    },
  });

  // Delete the rule itself
  await prisma.bookingRecurrenceRule.delete({ where: { id: ruleId } });

  return NextResponse.json({ deletedBookings: deleted.count });
}
