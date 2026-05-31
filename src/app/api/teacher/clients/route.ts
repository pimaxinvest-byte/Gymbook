import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_TEACHERS_PER_CLIENT = 2;

// GET /api/teacher/clients — list clients assigned to this teacher (TEACHER) or all assignments (ADMIN)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    where.teacherId = teacher.id;
  } else if (role === "CLIENT") {
    const client = await prisma.client.findUnique({ where: { userId: session.user.id } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    where.clientId = client.id;
  } else {
    // ADMIN
    if (clientId) where.clientId = clientId;
  }

  const assignments = await prisma.clientTeacher.findMany({
    where,
    include: {
      client: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true } } } },
      teacher: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true } } } },
    },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json(assignments);
}

// POST /api/teacher/clients — assign a client to a teacher
// Body: { clientId, teacherId? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { clientId, teacherId } = body;

  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  let resolvedTeacherId = teacherId;
  if (role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    resolvedTeacherId = teacher.id;
  }
  if (!resolvedTeacherId) return NextResponse.json({ error: "teacherId is required" }, { status: 400 });

  // Check max 2 teachers per client
  const count = await prisma.clientTeacher.count({ where: { clientId } });
  if (count >= MAX_TEACHERS_PER_CLIENT) {
    return NextResponse.json(
      { error: `Este cliente ya tiene ${MAX_TEACHERS_PER_CLIENT} entrenadores asignados (máximo permitido)` },
      { status: 409 }
    );
  }

  // Check not already assigned
  const existing = await prisma.clientTeacher.findUnique({
    where: { clientId_teacherId: { clientId, teacherId: resolvedTeacherId } },
  });
  if (existing) return NextResponse.json({ error: "Ya está asignado" }, { status: 409 });

  const assignment = await prisma.clientTeacher.create({
    data: { clientId, teacherId: resolvedTeacherId },
    include: {
      client: { include: { user: { select: { id: true, name: true, email: true } } } },
      teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(assignment, { status: 201 });
}

// DELETE /api/teacher/clients?clientId=&teacherId=
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  let teacherId = searchParams.get("teacherId");

  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  if (role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    teacherId = teacher.id;
  }
  if (!teacherId) return NextResponse.json({ error: "teacherId is required" }, { status: 400 });

  await prisma.clientTeacher.deleteMany({
    where: { clientId, teacherId },
  });

  return NextResponse.json({ success: true });
}
