import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/telegram/logs
 * Returns last 20 NotificationLog entries.
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.notificationLog.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      recipient: true,
      success: true,
      error: true,
      createdAt: true,
      booking: { select: { id: true } },
    },
  });

  return NextResponse.json(logs);
}
