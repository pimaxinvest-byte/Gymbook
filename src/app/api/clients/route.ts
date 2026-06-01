import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

// GET /api/clients — list all clients (TEACHER or ADMIN)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clients = await prisma.client.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(clients);
}

const createSchema = z.object({
  name:       z.string().min(2).max(100),
  email:      z.string().email(),
  phone:      z.string().max(30).optional(),
  teacherIds: z.array(z.string()).min(1).max(2),
});

// POST /api/clients — create a brand-new client user + assign to teacher(s)
// Auth: TEACHER or ADMIN
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { name, email, phone, teacherIds } = parsed.data;

  // Teachers can only include themselves as one of the assignees
  if (session.user.role === "TEACHER") {
    const self = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!self) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
    if (!teacherIds.includes(self.id)) {
      return NextResponse.json({ error: "Debes incluirte a ti mismo como uno de los entrenadores" }, { status: 400 });
    }
  }

  // Validate all teacherIds exist
  const teachers = await prisma.teacher.findMany({ where: { id: { in: teacherIds } } });
  if (teachers.length !== teacherIds.length) {
    return NextResponse.json({ error: "Uno o más entrenadores no existen" }, { status: 400 });
  }

  // Check email not already in use
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  // Create User + Client + assignments in one transaction
  const tempPassword = randomBytes(16).toString("hex");
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  const client = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name:     name.trim(),
        email:    email.toLowerCase().trim(),
        password: hashedPassword,
        role:     "CLIENT",
      },
    });

    const client = await tx.client.create({
      data: {
        userId: user.id,
        phone:  phone?.trim() || null,
        status: "ACTIVE",
      },
    });

    await tx.clientTeacher.createMany({
      data: teacherIds.map((teacherId) => ({ clientId: client.id, teacherId })),
      skipDuplicates: true,
    });

    return client;
  });

  return NextResponse.json({ ok: true, clientId: client.id }, { status: 201 });
}
