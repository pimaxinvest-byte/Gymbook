import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/harbiz/permission — check if current teacher has granted import consent
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const permission = await prisma.externalImportPermission.findUnique({
    where: { teacherId: teacher.id },
    select: { grantedAt: true, revokedAt: true, notes: true },
  });

  return NextResponse.json({
    granted: !!permission && !permission.revokedAt,
    grantedAt: permission?.grantedAt ?? null,
    revokedAt: permission?.revokedAt ?? null,
  });
}

// POST /api/harbiz/permission — grant consent
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const permission = await prisma.externalImportPermission.upsert({
    where: { teacherId: teacher.id },
    create: { teacherId: teacher.id, grantedAt: new Date(), grantedByIp: ip, userAgent, notes, revokedAt: null },
    update: { grantedAt: new Date(), grantedByIp: ip, userAgent, notes, revokedAt: null },
  });

  return NextResponse.json({ granted: true, grantedAt: permission.grantedAt });
}

// DELETE /api/harbiz/permission — revoke consent
export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  await prisma.externalImportPermission.updateMany({
    where: { teacherId: teacher.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ revoked: true });
}
