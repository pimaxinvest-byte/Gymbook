/**
 * GET /api/harbiz/status
 * Returns the last sync status for the current connection.
 *
 * Auth: ADMIN (any connection) or TEACHER (own connection only).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const isAdmin = session.user.role === "ADMIN";
  const isTeacher = session.user.role === "TEACHER";
  if (!isAdmin && !isTeacher) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Resolve connection filter
  let connectionWhere: { isActive: boolean; teacherId?: string } = { isActive: true };
  if (isTeacher) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ configured: false, lastSyncAt: null, recentLogs: [] });
    connectionWhere = { isActive: true, teacherId: teacher.id };
  }

  const connection = await prisma.teacherHarbizConnection.findFirst({
    where: connectionWhere,
    include: {
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          dryRun: true,
          clientsFound: true,
          clientsCreated: true,
          clientsUpdated: true,
          sessionsFound: true,
          sessionsCreated: true,
          packsFound: true,
          packsCreated: true,
          errors: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });

  if (!connection) {
    return NextResponse.json({ configured: false, lastSyncAt: null, recentLogs: [] });
  }

  return NextResponse.json({
    configured: true,
    connectionId: connection.id,
    lastSyncAt: connection.lastSyncAt,
    isActive: connection.isActive,
    recentLogs: connection.syncLogs,
  });
}
