import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Resolve which teacher we're operating on.
 *  - ADMIN can pass ?teacherId= to manage any teacher's permission.
 *  - TEACHER always operates on their own record.
 */
async function resolveTeacherId(
  session: { user: { id: string; role: string } },
  searchParams: URLSearchParams
): Promise<string | null> {
  if (session.user.role === "ADMIN") {
    const qid = searchParams.get("teacherId");
    if (qid) return qid;
    // Admin without teacherId → own teacher record (if any), else null
    const t = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    return t?.id ?? null;
  }
  const t = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  return t?.id ?? null;
}

// GET /api/harbiz/permission[?teacherId=] — check consent status
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teacherId = await resolveTeacherId(session, searchParams);
  if (!teacherId) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const permission = await prisma.externalImportPermission.findUnique({
    where: { teacherId },
    select: { grantedAt: true, revokedAt: true, notes: true },
  });

  return NextResponse.json({
    granted: !!permission && !permission.revokedAt,
    grantedAt: permission?.grantedAt ?? null,
    revokedAt: permission?.revokedAt ?? null,
  });
}

// POST /api/harbiz/permission[?teacherId=] — grant consent
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teacherId = await resolveTeacherId(session, searchParams);
  if (!teacherId) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const permission = await prisma.externalImportPermission.upsert({
    where: { teacherId },
    create: { teacherId, grantedAt: new Date(), grantedByIp: ip, userAgent, notes, revokedAt: null },
    update: { grantedAt: new Date(), grantedByIp: ip, userAgent, notes, revokedAt: null },
  });

  return NextResponse.json({ granted: true, grantedAt: permission.grantedAt });
}

// DELETE /api/harbiz/permission[?teacherId=] — revoke consent
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teacherId = await resolveTeacherId(session, searchParams);
  if (!teacherId) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  await prisma.externalImportPermission.updateMany({
    where: { teacherId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ revoked: true });
}
