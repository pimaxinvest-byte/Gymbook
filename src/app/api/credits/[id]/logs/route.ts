import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/credits/[id]/logs — return credit logs for a specific credit package
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = session.user.role;

  // Find the credit package to check access
  const creditRecord = await prisma.clientCredits.findUnique({
    where: { id },
    include: {
      client: { select: { userId: true } },
      teacher: { select: { userId: true } },
    },
  });

  if (!creditRecord) {
    return NextResponse.json({ error: "Credit package not found" }, { status: 404 });
  }

  // Authorization checks
  if (role === "CLIENT") {
    if (creditRecord.client.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "TEACHER") {
    if (creditRecord.teacher?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // ADMIN can see all — no additional check needed

  const logs = await prisma.creditLog.findMany({
    where: { clientCreditsId: id },
    include: {
      performedBy: { select: { name: true } },
      booking: {
        select: {
          startDatetime: true,
          activity: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(logs);
}
