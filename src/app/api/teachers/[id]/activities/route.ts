import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/teachers/[id]/activities — list activities for a teacher */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      teacherActivities: {
        include: { activity: true },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(teacher.teacherActivities.map((ta) => ta.activity));
}

/** POST /api/teachers/[id]/activities — assign activity to teacher */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { activityId } = body;

  if (!activityId) return NextResponse.json({ error: "activityId required" }, { status: 400 });

  try {
    const ta = await prisma.teacherActivity.create({
      data: { teacherId: id, activityId },
      include: { activity: true },
    });
    return NextResponse.json(ta.activity, { status: 201 });
  } catch {
    // unique constraint = already assigned
    return NextResponse.json({ error: "Actividad ya asignada" }, { status: 409 });
  }
}

/** DELETE /api/teachers/[id]/activities — remove activity from teacher */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const activityId = searchParams.get("activityId");

  if (!activityId) return NextResponse.json({ error: "activityId required" }, { status: 400 });

  await prisma.teacherActivity.deleteMany({
    where: { teacherId: id, activityId },
  });

  return NextResponse.json({ success: true });
}
