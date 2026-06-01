import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/teachers/me — returns the teacher record for the current user (TEACHER role)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
    select: { id: true, color: true, user: { select: { name: true, email: true } } },
  });

  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 404 });
  return NextResponse.json(teacher);
}
