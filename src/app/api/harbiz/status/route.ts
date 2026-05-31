/**
 * GET /api/harbiz/status
 * Returns the last sync status for the current connection.
 *
 * Auth: ADMIN only.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const connection = await prisma.teacherHarbizConnection.findFirst({
    where: { isActive: true },
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
