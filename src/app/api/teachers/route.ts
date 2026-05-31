import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teachers = await prisma.teacher.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, telegramChatId: true, telegramConnected: true, telegramUsername: true, avatarUrl: true } },
      teacherActivities: { include: { activity: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { user: { name: "asc" } },
  });

  // Ensure paymentsEnabled is always present (default true)
  const withPayments = teachers.map((t) => ({ ...t, paymentsEnabled: t.paymentsEnabled ?? true }));

  return NextResponse.json(withPayments);
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  color: z.string().optional(),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data = createSchema.parse(body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });

  const hashed = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, password: hashed, role: "TEACHER" },
  });

  const teacher = await prisma.teacher.create({
    data: {
      userId: user.id,
      color: data.color || "#6366f1",
      bio: data.bio,
      specialties: data.specialties || [],
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(teacher, { status: 201 });
}
