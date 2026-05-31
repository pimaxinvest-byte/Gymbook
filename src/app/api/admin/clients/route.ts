/**
 * GET  /api/admin/clients — list all clients with filters
 * Filters: status, teacherId, activityId, telegramConnected
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter     = searchParams.get("status");
  const teacherFilter    = searchParams.get("teacherId");
  const telegramFilter   = searchParams.get("telegram"); // "connected" | "pending"

  const where: Record<string, unknown> = {};

  if (statusFilter) where.status = statusFilter;

  if (teacherFilter) {
    where.clientTeachers = { some: { teacherId: teacherFilter } };
  }

  if (telegramFilter === "connected") {
    where.user = { telegramConnected: true };
  } else if (telegramFilter === "pending") {
    where.user = { telegramConnected: false };
  }

  const clients = await prisma.client.findMany({
    where,
    include: {
      user: {
        select: {
          id:                true,
          name:              true,
          email:             true,
          telegramChatId:    true,
          telegramUsername:  true,
          telegramPhone:     true,
          telegramConnected: true,
          avatarUrl:         true,
          createdAt:         true,
        },
      },
      clientTeachers: {
        include: { teacher: { include: { user: { select: { name: true } } } } },
      },
      preferredActivity: { select: { id: true, name: true } },
      preferredTeacher:  { include: { user: { select: { name: true } } } },
      _count: {
        select: { bookings: true, sgtParticipations: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}
